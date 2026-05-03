import { useEffect, useState } from 'react';
import RecordingDialog from '../RecordingDialog';
import WaveformNode from './WaveformNode';
import { useAlerts } from '../../../context/AlertContext';

const API_URL = 'http://localhost:8000';

const replayNameFromPath = (csvPath = '') => {
  const fileName = csvPath.split(/[\\/]/).pop() || '';
  return fileName.replace(/\.csv$/i, '') || 'CSVReplay';
};

const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '--';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
};

const CSVReplayNode = ({ monitor, dataRef, onPatch, onRecordingChange }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [metaBusy, setMetaBusy] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [latestPacket, setLatestPacket] = useState(null);
  const { pushAlert } = useAlerts();

  const streamName = monitor.stream?.name;
  const sample = streamName ? (latestPacket?.data ?? []) : [];
  const csvName = replayNameFromPath(monitor.csvPath);
  const showMetadata = monitor.csvPath?.trim() && !monitor.running ? metadata : null;

  useEffect(() => {
    if (!streamName) return undefined;

    const syncLatest = () => {
      const packets = dataRef?.current?.[streamName] ?? [];
      setLatestPacket(packets.length ? packets[packets.length - 1] : null);
    };

    const id = setInterval(syncLatest, 120);
    return () => clearInterval(id);
  }, [dataRef, streamName]);

  useEffect(() => {
    const path = (monitor.csvPath || '').trim();
    if (!path || monitor.running) return undefined;

    let cancelled = false;
    const run = async () => {
      setMetaBusy(true);
      try {
        const url = `${API_URL}/csv-replays/metadata?path=${encodeURIComponent(path)}&timestamp_column=${encodeURIComponent(monitor.timestampColumn || 'timestamp')}`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          throw new Error(data.detail ?? data.error ?? 'Unable to read CSV metadata');
        }
        setMetadata(data);
        onPatch({ sensorName: replayNameFromPath(data.path || path) });
      } catch (exc) {
        if (!cancelled) {
          setMetadata(null);
          setError(String(exc.message ?? exc));
        }
      } finally {
        if (!cancelled) setMetaBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [monitor.csvPath, monitor.running, monitor.timestampColumn, onPatch]);

  useEffect(() => {
    if (!monitor.running || !monitor.replayUid) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/csv-replays/${monitor.replayUid}`);
        const data = await res.json();
        if (cancelled || !res.ok || !data.ok) return;

        if (data.completed || !data.running) {
          onPatch({
            running: false,
            completed: Boolean(data.completed),
            savedTo: data.saved_to || '',
          });
          onRecordingChange(false, { intentional: true });

          if (data.saved_to) {
            pushAlert({
              type: 'success',
              title: 'Replay Recording Saved',
              message: `Saved to ${data.saved_to}`,
            });
          }
          if (data.error) {
            pushAlert({
              type: 'error',
              title: 'CSV Replay Error',
              message: data.error,
            });
          }
        }
      } catch {
        /* keep polling until completion or manual stop */
      }
    };

    poll();
    const id = setInterval(poll, 800);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [monitor.replayUid, monitor.running, onPatch, onRecordingChange, pushAlert]);

  const pickCsv = async () => {
    if (!window.echo?.pickFile) return;
    const picked = await window.echo.pickFile({
      defaultPath: monitor.csvPath || (await window.echo.getDefaultRecordingPath?.()) || undefined,
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (picked) {
      onPatch({ csvPath: picked, sensorName: replayNameFromPath(picked), completed: false, savedTo: '' });
      setError('');
    }
  };

  const handleStartClick = () => {
    if (!monitor.csvPath?.trim()) {
      setError('Choose a CSV file first.');
      return;
    }
    setShowRecordDialog(true);
  };

  const startReplay = async ({ filePath, format }) => {
    setBusy(true);
    setError('');
    try {
      const replayUid = monitor.replayUid || `csv_replay_${monitor.id}`;
      const replayName = csvName;
      const payload = {
        uid: replayUid,
        name: replayName,
        csv_path: monitor.csvPath,
        timestamp_column: monitor.timestampColumn || 'timestamp',
        record_file_path: filePath,
        record_format: format,
      };
      const res = await fetch(`${API_URL}/csv-replays/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.detail ?? data.error ?? 'Failed to start CSV replay');
      }

      onPatch({
        replayUid,
        sensorName: replayName,
        running: true,
        completed: false,
        savedTo: '',
        stream: data.stream,
      });
      onRecordingChange(true);
      setShowRecordDialog(false);
    } catch (exc) {
      setError(String(exc.message ?? exc));
    } finally {
      setBusy(false);
    }
  };

  const stopReplay = async () => {
    if (!monitor.replayUid) {
      onPatch({ running: false, stream: null });
      onRecordingChange(false, { intentional: true });
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/csv-replays/${monitor.replayUid}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      onPatch({ running: false, stream: null, savedTo: data.saved_to || '' });
      onRecordingChange(false, { intentional: true });
      if (data.saved_to) {
        pushAlert({
          type: 'success',
          title: 'Replay Recording Saved',
          message: `Saved to ${data.saved_to}`,
        });
      }
    } catch (exc) {
      setError(String(exc.message ?? exc));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full w-full overflow-auto bg-echo-surface p-2 text-white">
      <div className="space-y-2">
        {!monitor.running && (
          <>
            <label className="block">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-echo-muted">Replay CSV</p>
              <div className="flex gap-1">
                <input
                  value={monitor.csvPath || ''}
                  onChange={(e) => onPatch({ csvPath: e.target.value, sensorName: replayNameFromPath(e.target.value), completed: false, savedTo: '' })}
                  placeholder="path/to/replay.csv"
                  className="min-w-0 flex-1 border border-echo-border bg-echo-surface-2 px-2 py-1 text-xs text-white outline-none focus:border-echo-green"
                />
                {!!window.echo?.pickFile && (
                  <button
                    onClick={pickCsv}
                    className="border border-echo-border bg-echo-surface-2 px-2 py-1 text-[10px] font-semibold tracking-wider text-echo-muted hover:border-echo-green hover:text-white"
                  >
                    BROWSE
                  </button>
                )}
              </div>
            </label>

            <div className="rounded border border-echo-border bg-echo-surface-2 px-2 py-1 text-[10px] text-echo-muted">
              <p>File: <span className="font-mono text-white">{csvName}</span></p>
              <p>Rows: <span className="font-mono text-white">{showMetadata?.rows ?? '--'}</span></p>
              <p>Channels: <span className="font-mono text-white">{showMetadata?.channels ?? '--'}</span></p>
              <p>Duration: <span className="font-mono text-white">{formatDuration(showMetadata?.duration_seconds)}</span></p>
              {showMetadata?.channel_labels?.length > 0 && (
                <p className="mt-1 truncate">Labels: <span className="font-mono text-white">{showMetadata.channel_labels.join(', ')}</span></p>
              )}
              {metaBusy && <p className="mt-1">Reading CSV metadata...</p>}
              {monitor.savedTo && (
                <p className="mt-1">Last saved: <span className="font-mono text-white">{monitor.savedTo}</span></p>
              )}
            </div>

            <button
              onClick={handleStartClick}
              disabled={busy || metaBusy || !monitor.csvPath?.trim()}
              className="w-full border border-echo-green/60 bg-echo-green/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-echo-green hover:bg-echo-green/20 disabled:opacity-50"
            >
              {busy ? 'STARTING…' : 'START REPLAY'}
            </button>
          </>
        )}

        {monitor.running && monitor.stream && (
          <>
            <div className="h-40 overflow-hidden border border-echo-border bg-[#070d18]">
              <WaveformNode stream={monitor.stream} dataRef={dataRef} lineColor="#07dd96" />
            </div>

            <div className="border border-echo-border bg-echo-surface-2 px-2 py-1 text-[11px] text-echo-muted">
              <p>Replay: <span className="font-mono text-white">{monitor.stream.name}</span></p>
              <p>Latest Sample: <span className="font-mono text-white">{sample.length ? sample.join(', ') : '--'}</span></p>
            </div>

            <button
              onClick={stopReplay}
              disabled={busy}
              className="w-full border border-red-500/60 bg-red-500/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {busy ? 'STOPPING…' : 'STOP REPLAY'}
            </button>
          </>
        )}

        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>

      {showRecordDialog && (
        <RecordingDialog
          isElectron={Boolean(window.echo)}
          onCancel={() => setShowRecordDialog(false)}
          onConfirm={startReplay}
          startRecordingOnConfirm={false}
          title="CSV REPLAY"
          confirmLabel="Start Replay"
        />
      )}
    </div>
  );
};

export default CSVReplayNode;