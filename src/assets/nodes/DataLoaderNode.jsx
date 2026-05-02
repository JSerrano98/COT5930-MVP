import { useState } from 'react';
import { Position } from 'reactflow';
import MLNodeBase, { LabeledHandle } from './MLNodeBase';

const SOURCES = [
  { key: 'csv',       label: 'CSV File' },
  { key: 'recording', label: 'Recorded Session' },
  { key: 'live',      label: 'Live Stream (Snapshot)' },
];

const DataLoaderNode = ({ data }) => {
  const [source, setSource] = useState(data?.config?.source ?? 'csv');
  const [path, setPath]     = useState(data?.config?.path   ?? '');
  const [label, setLabel]   = useState(data?.config?.label  ?? '');
  const [sep, setSep]       = useState(data?.config?.sep    ?? ',');

  const update = (patch) => {
    data?.onConfigChange?.({ source, path, label, sep, ...patch });
  };

  return (
    <MLNodeBase
      label={data?.label ?? 'Data Loader'}
      status={data?.status}
      onRemove={data?.onRemove}
      handles={
        <LabeledHandle type="source" position={Position.Right} label="data out" top="50%" />
      }
    >
      {/* Source selector */}
      <div className="mb-3">
        <p className="text-[10px] text-echo-muted uppercase tracking-widest mb-1">Source</p>
        <div className="flex gap-1 flex-wrap">
          {SOURCES.map(s => (
            <button
              key={s.key}
              onClick={() => { setSource(s.key); update({ source: s.key }); }}
              className={`px-2 py-1 text-[10px] font-semibold border transition-colors ${
                source === s.key
                  ? 'bg-echo-green/20 border-echo-green text-echo-green'
                  : 'bg-echo-surface-2 border-echo-border text-echo-muted hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {source === 'csv' && (
        <>
          <div className="mb-2">
            <p className="text-[10px] text-echo-muted uppercase tracking-widest mb-1">File Path</p>
            <div className="flex gap-1">
              <input
                className="flex-1 bg-echo-surface-2 border border-echo-border text-white text-xs px-2 py-1 focus:outline-none focus:border-echo-green min-w-0"
                placeholder="data/recordings/session.csv"
                value={path}
                onChange={e => { setPath(e.target.value); update({ path: e.target.value }); }}
              />
              <button
                className="px-2 py-1 text-[10px] font-semibold bg-echo-surface-2 border border-echo-border text-echo-muted hover:text-white hover:bg-echo-surface transition-colors whitespace-nowrap"
                onClick={async () => {
                  try {
                    const picked = await window.echo.pickFile({
                      filters: [
                        { name: 'CSV Files', extensions: ['csv'] },
                        { name: 'All Files', extensions: ['*'] },
                      ],
                    });
                    if (picked) { setPath(picked); update({ path: picked }); }
                  } catch (err) {
                    console.error('pickFile error', err);
                  }
                }}
              >
                Browse
              </button>
            </div>
          </div>
          <div className="mb-2">
            <p className="text-[10px] text-echo-muted uppercase tracking-widest mb-1">Delimiter</p>
            <input
              className="w-24 bg-echo-surface-2 border border-echo-border text-white text-xs px-2 py-1 focus:outline-none focus:border-echo-green"
              value={sep}
              onChange={e => { setSep(e.target.value); update({ sep: e.target.value }); }}
            />
          </div>
        </>
      )}

      {source === 'recording' && (
        <div className="mb-2">
          <p className="text-[10px] text-echo-muted uppercase tracking-widest mb-1">Session Name</p>
          <input
            className="w-full bg-echo-surface-2 border border-echo-border text-white text-xs px-2 py-1 focus:outline-none focus:border-echo-green"
            placeholder="session_2024_01_01"
            value={path}
            onChange={e => { setPath(e.target.value); update({ path: e.target.value }); }}
          />
        </div>
      )}

      <div className="mb-1">
        <p className="text-[10px] text-echo-muted uppercase tracking-widest mb-1">Label Column</p>
        <input
          className="w-full bg-echo-surface-2 border border-echo-border text-white text-xs px-2 py-1 focus:outline-none focus:border-echo-green"
          placeholder="label"
          value={label}
          onChange={e => { setLabel(e.target.value); update({ label: e.target.value }); }}
        />
      </div>

      {data?.result && (
        <div className="mt-3 pt-2 border-t border-echo-border">
          <p className="text-[10px] text-echo-green font-body">
            âœ“ {data.result.rows} rows Â· {data.result.cols} cols
          </p>
        </div>
      )}
    </MLNodeBase>
  );
};

export default DataLoaderNode;
