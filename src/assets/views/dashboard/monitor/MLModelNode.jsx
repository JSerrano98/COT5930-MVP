import { useEffect, useMemo, useRef, useState } from 'react';

const API_URL = 'http://localhost:8000';

const modelNameFromPath = (modelPath = '') => {
  const fileName = modelPath.split(/[\\/]/).pop() || '';
  return fileName.replace(/\.pkl$/i, '') || 'ML_Model';
};

const arraysEqual = (a = [], b = []) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const objectsEqual = (a = {}, b = {}) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[k] === b[k]);
};

const MLModelNode = ({ monitor, streams = [], dataRef, onPatch }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [metaBusy, setMetaBusy] = useState(false);
  const [modelMeta, setModelMeta] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [latestPacket, setLatestPacket] = useState(null);
  const lastPacketMarkerRef = useRef(null);

  const streamName = monitor.stream?.name;
  useEffect(() => {
    if (!streamName) {
      setLatestPacket(null);
      lastPacketMarkerRef.current = null;
      return;
    }

    const syncLatest = () => {
      const pkts = dataRef?.current?.[streamName] ?? [];
      const pkt = pkts.length ? pkts[pkts.length - 1] : null;
      const marker = pkt ? `${pkt.receiveTime ?? ''}_${pkt.timestamp ?? ''}_${pkts.length}` : null;
      if (marker !== lastPacketMarkerRef.current) {
        lastPacketMarkerRef.current = marker;
        setLatestPacket(pkt);
      }
    };

    syncLatest();
    const id = setInterval(syncLatest, 120);
    return () => clearInterval(id);
  }, [dataRef, streamName]);

  const sample = latestPacket?.data ?? [];
  const prediction = sample[0];
  const confidence = sample[1];
  const modelStream = monitor.stream;
  const hasConfidence = Array.isArray(modelStream?.channel_labels)
    ? modelStream.channel_labels.includes('confidence')
    : Number(modelStream?.channels || 0) > 1;
  const formattedPrediction = Number.isFinite(Number(prediction))
    ? Number(prediction).toFixed(4)
    : (prediction ?? '--');
  const formattedConfidence = Number.isFinite(Number(confidence))
    ? `${(Number(confidence) * 100).toFixed(1)}%`
    : '--';
  const selectedSourceNames = Array.isArray(monitor.sourceNames)
    ? monitor.sourceNames
    : (monitor.sourceName ? [monitor.sourceName] : []);
  const manualAliases = monitor.featureAliases || {};

  const availableChannels = useMemo(() => {
    const sourceFilter = selectedSourceNames.length ? new Set(selectedSourceNames) : null;
    const out = [];
    streams.forEach((s) => {
      if (sourceFilter && !sourceFilter.has(s.name)) return;
      const labels = Array.isArray(s.channel_labels) && s.channel_labels.length
        ? s.channel_labels
        : Array.from({ length: s.channels || 0 }, (_, i) => `${s.name}_ch${i + 1}`);
      labels.forEach((label, idx) => {
        out.push({
          id: `${s.name}::${idx}`,
          streamName: s.name,
          label,
          lookup: `${s.name}::${label}`,
          display: `${s.name} / ${label}`,
        });
      });
    });
    return out;
  }, [streams, selectedSourceNames]);

  const autoAliases = useMemo(() => {
    if (!modelMeta?.feature_cols?.length) return {};

    const byLabel = new Map();
    availableChannels.forEach((ch) => {
      if (!byLabel.has(ch.label)) byLabel.set(ch.label, []);
      byLabel.get(ch.label).push(ch);
    });

    const map = {};
    for (const feature of modelMeta.feature_cols) {
      const matches = byLabel.get(feature) || [];
      if (matches.length === 1) {
        map[feature] = matches[0].lookup;
      }
      if (matches.length > 1) {
        map[feature] = matches[0].lookup;
      }
    }
    return map;
  }, [modelMeta, availableChannels]);

  const effectiveAliases = useMemo(
    () => ({ ...autoAliases, ...manualAliases }),
    [autoAliases, manualAliases],
  );

  const backendKeySet = useMemo(() => {
    const keys = new Set();
    availableChannels.forEach((ch) => {
      keys.add(ch.label);
      keys.add(ch.lookup);
    });
    return keys;
  }, [availableChannels]);

  const validEffectiveAliases = useMemo(
    () => Object.fromEntries(
      Object.entries(effectiveAliases).filter(([, lookup]) => backendKeySet.has(String(lookup))),
    ),
    [effectiveAliases, backendKeySet],
  );

  const isFeatureMatched = useMemo(() => {
    const out = {};
    (modelMeta?.feature_cols || []).forEach((feature) => {
      const alias = validEffectiveAliases[feature];
      out[feature] = Boolean(alias ? backendKeySet.has(alias) : backendKeySet.has(feature));
    });
    return out;
  }, [modelMeta, validEffectiveAliases, backendKeySet]);

  const matchedCount = useMemo(() => {
    if (!modelMeta?.feature_cols?.length) return 0;
    return modelMeta.feature_cols.filter((f) => isFeatureMatched[f]).length;
  }, [modelMeta, isFeatureMatched]);

  const unresolvedFeatures = useMemo(() => {
    if (!modelMeta?.feature_cols?.length) return [];
    return modelMeta.feature_cols.filter((f) => !isFeatureMatched[f]);
  }, [modelMeta, isFeatureMatched]);

  useEffect(() => {
    const path = (monitor.modelPath || '').trim();
    if (!path || monitor.running) {
      setModelMeta(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setMetaBusy(true);
      try {
        const res = await fetch(`${API_URL}/ml-models/metadata?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          throw new Error(data.detail ?? data.error ?? 'Unable to read model metadata');
        }
        setModelMeta(data);
      } catch (e) {
        if (!cancelled) {
          setModelMeta(null);
          setError(String(e.message ?? e));
        }
      } finally {
        if (!cancelled) setMetaBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [monitor.modelPath, monitor.running]);

  useEffect(() => {
    if (!modelMeta?.feature_cols?.length || monitor.running) return;

    const suggested = Array.from(new Set(
      Object.values(autoAliases)
        .map((lookup) => String(lookup).split('::')[0])
        .filter(Boolean),
    ));

    const nextSourceNames = selectedSourceNames.length ? selectedSourceNames : suggested;

    const cleanedManual = Object.fromEntries(
      Object.entries(manualAliases).filter(([feature, lookup]) => {
        if (!modelMeta.feature_cols.includes(feature)) return false;
        const key = String(lookup).trim();
        return key.length > 0 && backendKeySet.has(key);
      }),
    );

    const patch = {};
    if (nextSourceNames.length && !arraysEqual(nextSourceNames, selectedSourceNames)) {
      patch.sourceNames = nextSourceNames;
      patch.sourceName = nextSourceNames[0] || '';
    }
    if (!objectsEqual(cleanedManual, manualAliases)) {
      patch.featureAliases = cleanedManual;
    }
    if (Object.keys(patch).length) onPatch(patch);
  }, [
    autoAliases,
    manualAliases,
    modelMeta,
    monitor.running,
    onPatch,
    selectedSourceNames,
    backendKeySet,
  ]);

  const pickModel = async () => {
    const defaultPath = monitor.modelPath || (await window.echo.getDefaultModelPath?.()) || undefined;
    const picked = await window.echo.pickFile({
      defaultPath,
      filters: [
        { name: 'Trained Models', extensions: ['pkl'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (picked) onPatch({ modelPath: picked, sensorName: modelNameFromPath(picked) });
  };

  const startModelSensor = async () => {
    if (monitor.running || busy) return;

    if (!monitor.modelPath?.trim()) {
      setError('Choose a model file first.');
      return;
    }

    if (!modelMeta) {
      setError('Model metadata is still loading. Wait for feature mapping to finish.');
      return;
    }

    if ((modelMeta.feature_cols?.length ?? 0) > 0 && matchedCount < modelMeta.feature_cols.length) {
      setError(`Feature mapping incomplete (${matchedCount}/${modelMeta.feature_cols.length}).`);
      return;
    }

    const requestedSources = selectedSourceNames.length
      ? selectedSourceNames
      : streams.map((s) => s.name);
    if (requestedSources.length === 0) {
      setError('No source streams available yet. Start sensors and try again.');
      return;
    }

    if (selectedSourceNames.length === 0) {
      onPatch({ sourceNames: requestedSources, sourceName: requestedSources[0] || '' });
    }

    setBusy(true);
    setError('');

    try {
      const sensorUid = monitor.sensorUid || `ml_${monitor.id}`;
      const sensorName = modelNameFromPath(monitor.modelPath);

      const payload = {
        uid: sensorUid,
        name: sensorName,
        source_name: requestedSources[0],
        source_names: requestedSources,
        source_type: monitor.sourceType || '',
        model_path: monitor.modelPath,
        buffer_seconds: monitor.bufferSeconds ?? 2.0,
        process_interval: monitor.processInterval ?? 0.1,
        feature_aliases: validEffectiveAliases,
      };

      const res = await fetch(`${API_URL}/ml-sensors/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.detail ?? data.error ?? 'Failed to start ML sensor');
      }

      onPatch({
        sensorUid,
        sensorName,
        sourceNames: requestedSources,
        featureAliases: validEffectiveAliases,
        running: true,
        stream: data.stream || {
          name: sensorName,
          type: 'ML',
          channels: 1,
          rate: 0,
          channel_labels: ['prediction'],
        },
      });
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const stopModelSensor = async () => {
    if (!monitor.sensorUid) {
      onPatch({ running: false });
      return;
    }

    setBusy(true);
    setError('');
    try {
      await fetch(`${API_URL}/ml-sensors/${monitor.sensorUid}`, { method: 'DELETE' });
      onPatch({ running: false, stream: null });
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="h-full w-full overflow-auto bg-echo-surface p-2 text-white"
      onWheelCapture={(e) => e.stopPropagation()}
    >
      <div className="space-y-2">
        {!monitor.running && (
          <div className="block">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-echo-muted">Source Streams</p>
              <div className="flex items-center gap-2 text-[9px] font-mono text-echo-muted">
                <button
                  type="button"
                  onClick={() => onPatch({ sourceNames: streams.map((s) => s.name), sourceName: streams[0]?.name || '' })}
                  className="hover:text-white"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => onPatch({ sourceNames: [], sourceName: '' })}
                  className="hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-24 space-y-1 overflow-auto border border-echo-border bg-echo-surface-2 px-2 py-1">
              {streams.length === 0 && (
                <p className="text-[10px] text-echo-muted">No streams available.</p>
              )}
              {streams.map((s) => {
                const checked = selectedSourceNames.includes(s.name);
                return (
                  <label key={s.name} className="flex cursor-pointer items-center gap-2 text-[11px] text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedSourceNames, s.name]
                          : selectedSourceNames.filter((n) => n !== s.name);
                        onPatch({ sourceNames: next, sourceName: next[0] || '' });
                      }}
                      className="h-3 w-3 accent-emerald-400"
                    />
                    <span className="truncate">{s.name} ({s.type})</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {!monitor.running && (
          <div className="rounded border border-echo-border bg-echo-surface-2 px-2 py-1 text-[10px] text-echo-muted">
            <p>Model: <span className="font-mono text-white">{modelNameFromPath(monitor.modelPath)}</span></p>
            <p>Task: <span className="font-mono text-white">{modelMeta?.task || '--'}</span></p>
            <p>Label: <span className="font-mono text-white">{modelMeta?.label_col || '--'}</span></p>
            <p>Features: <span className="font-mono text-white">{modelMeta?.feature_count ?? '--'}</span></p>
            <p>Matched: <span className="font-mono text-white">{matchedCount}</span></p>
            {metaBusy && <p className="mt-1">Reading model metadata...</p>}
          </div>
        )}

        {!monitor.running && !!modelMeta?.feature_cols?.length && (
          <div className="rounded border border-echo-border bg-echo-surface-2 px-2 py-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-echo-muted">Feature Mapping</p>
              <button
                type="button"
                onClick={() => setManualOpen((v) => !v)}
                className="text-[9px] font-mono text-echo-muted hover:text-white"
              >
                {manualOpen ? 'Hide' : 'Manual Adjust'}
              </button>
            </div>

            {!manualOpen && (
              <p className="mt-1 text-[10px] text-echo-muted">
                {unresolvedFeatures.length
                  ? `${unresolvedFeatures.length} feature(s) need mapping`
                  : 'All features mapped'}
              </p>
            )}

            {manualOpen && (
              <div className="mt-1 max-h-40 space-y-1 overflow-auto">
                {modelMeta.feature_cols.map((feature) => {
                  const value = manualAliases[feature] || effectiveAliases[feature] || '';
                  return (
                    <label key={feature} className="block text-[10px] text-echo-muted">
                      <p className="truncate">{feature}</p>
                      <select
                        value={value}
                        onChange={(e) => {
                          const next = { ...(monitor.featureAliases || {}) };
                          if (!e.target.value) delete next[feature];
                          else next[feature] = e.target.value;
                          onPatch({ featureAliases: next });
                        }}
                        className="mt-0.5 w-full border border-echo-border bg-echo-surface px-1 py-1 text-[10px] text-white outline-none focus:border-echo-green"
                      >
                        <option value="">Auto</option>
                        {availableChannels.map((ch) => (
                          <option key={`${feature}_${ch.id}`} value={ch.lookup}>{ch.display}</option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!monitor.running && (
          <label className="block">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-echo-muted">Model File (.pkl)</p>
            <div className="flex gap-1">
              <input
                value={monitor.modelPath || ''}
                onChange={(e) => onPatch({ modelPath: e.target.value, sensorName: modelNameFromPath(e.target.value) })}
                placeholder="path/to/model.pkl"
                className="min-w-0 flex-1 border border-echo-border bg-echo-surface-2 px-2 py-1 text-xs text-white outline-none focus:border-echo-green"
              />
              <button
                onClick={pickModel}
                className="border border-echo-border bg-echo-surface-2 px-2 py-1 text-[10px] font-semibold tracking-wider text-echo-muted hover:border-echo-green hover:text-white"
              >
                BROWSE
              </button>
            </div>
            <p className="mt-1 text-[10px] text-echo-muted">Default folder: Documents/ECHO Trained Models</p>
          </label>
        )}

        {!monitor.running && (
          <div className="flex gap-1 pt-1">
            <button
              onClick={startModelSensor}
              disabled={busy || metaBusy}
              className="flex-1 border border-echo-green/60 bg-echo-green/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-echo-green hover:bg-echo-green/20 disabled:opacity-50"
            >
              {busy ? 'STARTING…' : 'START MODEL'}
            </button>
          </div>
        )}

        {error && <p className="text-[10px] text-red-400">{error}</p>}

        {monitor.running && modelStream && (
          <>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <div className="border border-echo-border bg-echo-surface-2 px-2 py-2">
                <p className="text-[9px] uppercase tracking-widest text-echo-dim">Prediction</p>
                <p className="mt-1 font-mono text-xl text-echo-green">{formattedPrediction}</p>
              </div>
              <div className="border border-echo-border bg-echo-surface-2 px-2 py-2">
                <p className="text-[9px] uppercase tracking-widest text-echo-dim">Confidence</p>
                <p className="mt-1 font-mono text-xl text-white">{hasConfidence ? formattedConfidence : 'N/A'}</p>
              </div>
            </div>

            <div className="border border-echo-border bg-echo-surface-2 px-2 py-1 text-[10px] text-echo-muted">
              <p>Stream: <span className="font-mono text-white">{modelStream.name}</span></p>
              <p>Rate: <span className="font-mono text-white">{modelStream.rate || 0} Hz</span></p>
            </div>

            <button
              onClick={stopModelSensor}
              disabled={busy}
              className="w-full border border-red-500/60 bg-red-500/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {busy ? 'STOPPING…' : 'STOP MODEL'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MLModelNode;