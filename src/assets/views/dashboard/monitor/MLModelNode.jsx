import { useMemo, useState } from 'react';

const API_URL = 'http://localhost:8000';

const MLModelNode = ({ monitor, streams = [], dataRef, onPatch }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const streamName = monitor.stream?.name;
  const latestPacket = useMemo(() => {
    if (!streamName) return null;
    const pkts = dataRef?.current?.[streamName] ?? [];
    return pkts.length ? pkts[pkts.length - 1] : null;
  }, [dataRef, streamName]);

  const sample = latestPacket?.sample ?? [];
  const prediction = sample[0];
  const confidence = sample[1];

  const pickModel = async () => {
    if (!window.echo?.pickFile) return;
    const defaultPath = monitor.modelPath || (await window.echo.getDefaultModelPath?.()) || undefined;
    const picked = await window.echo.pickFile({
      defaultPath,
      filters: [
        { name: 'Trained Models', extensions: ['pkl'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (picked) onPatch({ modelPath: picked });
  };

  const startModelSensor = async () => {
    if (!monitor.modelPath?.trim()) {
      setError('Choose a model file first.');
      return;
    }
    if (!monitor.sourceName?.trim()) {
      setError('Choose a source stream first.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const sensorUid = monitor.sensorUid || `ml_${monitor.id}`;
      const sensorName = (monitor.sensorName || `ML_${monitor.id}`).trim();

      const payload = {
        uid: sensorUid,
        name: sensorName,
        source_name: monitor.sourceName,
        source_type: monitor.sourceType || '',
        model_path: monitor.modelPath,
        buffer_seconds: monitor.bufferSeconds ?? 2.0,
        process_interval: monitor.processInterval ?? 0.1,
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
        running: true,
        stream: { name: sensorName, type: 'ML', channels: 2, rate: 0 },
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
      onPatch({ running: false });
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full w-full overflow-auto bg-echo-surface p-2 text-white">
      <div className="space-y-2">
        <label className="block">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-echo-muted">Model Name</p>
          <input
            value={monitor.sensorName || ''}
            onChange={(e) => onPatch({ sensorName: e.target.value })}
            placeholder="ML_Stress_Predictor"
            className="w-full border border-echo-border bg-echo-surface-2 px-2 py-1 text-xs text-white outline-none focus:border-echo-green"
          />
        </label>

        <label className="block">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-echo-muted">Source Stream</p>
          <select
            value={monitor.sourceName || ''}
            onChange={(e) => onPatch({ sourceName: e.target.value })}
            className="w-full border border-echo-border bg-echo-surface-2 px-2 py-1 text-xs text-white outline-none focus:border-echo-green"
          >
            <option value="">Select source stream…</option>
            {streams.map((s) => (
              <option key={s.name} value={s.name}>{s.name} ({s.type})</option>
            ))}
          </select>
        </label>

        <label className="block">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-echo-muted">Model File (.pkl)</p>
          <div className="flex gap-1">
            <input
              value={monitor.modelPath || ''}
              onChange={(e) => onPatch({ modelPath: e.target.value })}
              placeholder="path/to/model.pkl"
              className="min-w-0 flex-1 border border-echo-border bg-echo-surface-2 px-2 py-1 text-xs text-white outline-none focus:border-echo-green"
            />
            {!!window.echo?.pickFile && (
              <button
                onClick={pickModel}
                className="border border-echo-border bg-echo-surface-2 px-2 py-1 text-[10px] font-semibold tracking-wider text-echo-muted hover:border-echo-green hover:text-white"
              >
                BROWSE
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] text-echo-muted">Default folder: Documents/ECHO Trained Models</p>
        </label>

        <div className="flex gap-1 pt-1">
          {!monitor.running ? (
            <button
              onClick={startModelSensor}
              disabled={busy}
              className="flex-1 flex-1 border border-echo-green/60 bg-echo-green/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-echo-green hover:bg-echo-green/20 disabled:opacity-50"
            >
              {busy ? 'STARTING…' : 'START MODEL'}
            </button>
          ) : (
            <button
              onClick={stopModelSensor}
              disabled={busy}
              className="flex-1 border border-red-500/60 bg-red-500/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {busy ? 'STOPPING…' : 'STOP MODEL'}
            </button>
          )}
        </div>

        {error && <p className="text-[10px] text-red-400">{error}</p>}

        <div className="mt-2 border-t border-echo-border pt-2 text-[11px] text-echo-muted">
          <p>Prediction: <span className="font-mono text-white">{prediction ?? '--'}</span></p>
          <p>Confidence: <span className="font-mono text-white">{confidence ?? '--'}</span></p>
          <p className="mt-1 text-[10px] text-echo-muted">Stream: {streamName || 'Not started'}</p>
        </div>
      </div>
    </div>
  );
};

export default MLModelNode;
