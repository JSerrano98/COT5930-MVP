import { useState } from 'react';

const API_URL = 'http://localhost:8000';

const fmt = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
    `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
};

const getRecordingsDir = () =>
  localStorage.getItem('echo_recordings_dir') || 'backend/recordings';

const RecordingDialog = ({
  onConfirm,
  onCancel,
  isElectron,
  title = 'NEW RECORDING',
  confirmLabel = 'Start Recording',
  startRecordingOnConfirm = true,
}) => {
  const [fileName, setFileName] = useState(`recording_${fmt(new Date())}`);
  const [format,   setFormat]   = useState('csv');
  const [loading,  setLoading]  = useState(false);

  const handleStart = async () => {
    if (!fileName.trim()) return;
    setLoading(true);

    const extMap = { csv: '.csv', xlsx: '.xlsx', xdf: '.xdf' };
    const ext = extMap[format] ?? '.csv';
    const name = fileName.trim().replace(/\.[^/.]+$/, '');
    const folder = getRecordingsDir();
    const filePath = `${folder}/${name}${ext}`;

    if (startRecordingOnConfirm) {
      if (isElectron && window.echo?.startRecording) {
        await window.echo.startRecording({ filePath, format });
      } else {
        await fetch(`${API_URL}/record/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: filePath, format }),
        }).catch(() => {});
      }
    }

    setLoading(false);
    onConfirm({ filePath, format });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-echo-surface border border-echo-border shadow-2xl w-[380px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-echo-border bg-echo-surface-2">
          <span className="font-title text-xl tracking-[0.1em] text-white">{title}</span>
          <button
            onClick={onCancel}
            className="text-echo-dim hover:text-white transition-colors text-lg leading-none font-ui"
          >×</button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-5">

          {/* File name */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[9px] font-ui font-semibold text-echo-muted uppercase tracking-widest">File Name</span>
            <input
              type="text"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              className="bg-echo-surface-2 border border-echo-border text-white text-sm px-3 py-2 focus:border-echo-green font-body"
              spellCheck={false}
            />
          </label>

          {/* Format */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[9px] font-ui font-semibold text-echo-muted uppercase tracking-widest">Format</span>
            <div className="flex gap-1">
              {['csv', 'xlsx', 'xdf'].map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 text-[10px] font-ui font-semibold tracking-widest uppercase border transition-colors ${
                    format === f
                      ? 'bg-echo-border border-echo-muted text-white'
                      : 'bg-echo-surface-2 border-echo-border text-echo-dim hover:border-echo-muted hover:text-echo-muted'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <span className="text-[9px] text-echo-dim font-body">
              {format === 'csv'
                ? 'CSV — lightweight, compatible with Python / Excel / R'
                : format === 'xlsx'
                ? 'Excel (.xlsx) — formatted spreadsheet'
                : 'XDF — standard LSL archival format, loadable with EEGLAB / MNE / pyxdf'}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-1 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-[10px] font-ui font-semibold tracking-widest uppercase border border-echo-border text-echo-dim hover:text-white hover:border-echo-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={loading || !fileName.trim()}
            className="flex-1 py-2 text-[10px] font-ui font-semibold tracking-widest uppercase bg-red-600/20 border border-red-500/60 text-red-300 hover:bg-red-600/30 hover:text-red-200 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            <span className="flex items-center justify-center gap-2">
              <span className="echo-circle w-2 h-2 bg-red-400 inline-block" />
              {loading ? 'Starting…' : confirmLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingDialog;
