import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

const fmt = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
    `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
};

/**
 * Modal dialog shown when the user clicks "Record".
 * Props:
 *   onConfirm({ filePath, format }) — called when user starts recording
 *   onCancel() — called when dialog is dismissed
 *   isElectron — whether Electron APIs are available
 */
const RecordingDialog = ({ onConfirm, onCancel, isElectron }) => {
  const [fileName, setFileName]   = useState(`recording_${fmt(new Date())}`);
  const [format,   setFormat]     = useState('csv');
  const [folder,   setFolder]     = useState('');
  const [loading,  setLoading]    = useState(false);

  // On mount: resolve default save folder
  useEffect(() => {
    const resolve = async () => {
      if (isElectron && window.echo?.getDefaultRecordingPath) {
        const p = await window.echo.getDefaultRecordingPath();
        setFolder(p ?? '');
      } else {
        setFolder('backend/recordings');
      }
    };
    resolve();
  }, [isElectron]);

  const handleBrowse = async () => {
    try {
      const picked = await window.echo.pickFolder(folder || undefined);
      if (picked) setFolder(picked);
    } catch (err) {
      console.error('pickFolder failed:', err);
    }
  };

  const handleStart = async () => {
    if (!fileName.trim()) return;
    setLoading(true);

    const extMap = { csv: '.csv', xlsx: '.xlsx', xdf: '.xdf' };
    const ext = extMap[format] ?? '.csv';
    const name = fileName.trim().replace(/\.[^/.]+$/, ''); // strip existing ext
    const filePath = folder ? `${folder}/${name}${ext}` : `${name}${ext}`;

    if (isElectron && window.echo?.startRecording) {
      await window.echo.startRecording({ filePath, format });
    } else {
      // Non-Electron: call backend directly
      await fetch(`${API_URL}/record/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, format }),
      }).catch(() => {});
    }

    setLoading(false);
    onConfirm({ filePath, format });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-sm shadow-2xl w-[420px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <span className="text-sm font-semibold text-white tracking-wide">New Recording</span>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
          >×</button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-5">

          {/* File name */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">File Name</span>
            <input
              type="text"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-slate-400 font-mono"
              spellCheck={false}
            />
          </label>

          {/* Format */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Format</span>
            <div className="flex gap-2">
              {['csv', 'xlsx', 'xdf'].map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 text-xs font-semibold tracking-widest uppercase border transition-colors ${
                    format === f
                      ? 'bg-slate-700 border-slate-400 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">
              {format === 'csv'
                ? 'CSV — lightweight, compatible with Python / Excel / R'
                : format === 'xlsx'
                ? 'Excel (.xlsx) — formatted spreadsheet'
                : 'XDF — standard LSL archival format, loadable with EEGLAB / MNE / pyxdf'}
            </span>
          </label>

          {/* Save folder */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Save Folder</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={folder}
                onChange={e => setFolder(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-600 text-slate-100 text-xs px-3 py-2 rounded-sm focus:outline-none focus:border-slate-400 font-mono truncate"
                spellCheck={false}
              />
              {isElectron && (
                <button
                  onClick={handleBrowse}
                  className="px-3 py-2 text-xs font-semibold bg-slate-800 border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors"
                >
                  Browse
                </button>
              )}
            </div>
            <span className="text-[10px] text-slate-500">
              Default folder is created automatically if missing.
            </span>
          </label>

          {/* Preview path */}
          <div className="bg-slate-800/60 rounded-sm px-3 py-2 text-[10px] font-mono text-slate-500 truncate">
            → {folder ? `${folder}/` : ''}{fileName.trim() || 'recording'}
            {format === 'xlsx' ? '.xlsx' : format === 'xdf' ? '.xdf' : '.csv'}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-xs font-semibold border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={loading || !fileName.trim()}
            className="flex-1 py-2 text-xs font-semibold bg-red-600/20 border border-red-500/60 text-red-300 hover:bg-red-600/30 hover:text-red-200 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            <span className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              {loading ? 'Starting…' : 'Start Recording'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingDialog;
