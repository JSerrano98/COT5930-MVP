import { useState, useEffect } from 'react';
import { NodeResizeControl } from 'reactflow';

const NODE_TYPE_LABELS = {
  waveform: 'WAVEFORM',
  stats:    'STATS',
};

const Monitor = ({ stream, nodeType, lineColor, onColorChange, onRemove, dataRef, children }) => {
  const [latencyMs, setLatencyMs] = useState(null);

  useEffect(() => {
    if (!dataRef || !stream) return;
    const id = setInterval(() => {
      const pkts = dataRef.current?.[stream.name];
      if (pkts?.length) {
        const last = pkts[pkts.length - 1];
        if (last.receiveTime != null) setLatencyMs(Date.now() - last.receiveTime);
      }
    }, 250);
    return () => clearInterval(id);
  }, [dataRef, stream]);

  const latencyColor =
    latencyMs === null  ? '#475569' :  // no data — slate
    latencyMs < 100     ? '#22c55e' :  // green  < 100 ms
    latencyMs < 300     ? '#eab308' :  // yellow < 300 ms
                          '#ef4444';   // red    ≥ 300 ms

  const latencyLabel =
    latencyMs === null ? 'No data' :
    latencyMs < 100    ? `Good (${latencyMs} ms)` :
    latencyMs < 300    ? `Fair (${latencyMs} ms)` :
                         `Poor (${latencyMs} ms)`;

  return (
  <div className="flex flex-col bg-slate-900 border border-slate-700 overflow-hidden w-full h-full">

    {/* Header — drag handle */}
    <div className="monitor-drag flex items-center gap-2 px-3 py-1.5 border-b border-slate-700 bg-slate-800 flex-shrink-0 cursor-grab active:cursor-grabbing select-none">

      {/* Drag grip icon */}
      <svg className="w-3 h-3 text-slate-600 flex-shrink-0" fill="currentColor" viewBox="0 0 8 12">
        <circle cx="2" cy="2"  r="1"/><circle cx="6" cy="2"  r="1"/>
        <circle cx="2" cy="6"  r="1"/><circle cx="6" cy="6"  r="1"/>
        <circle cx="2" cy="10" r="1"/><circle cx="6" cy="10" r="1"/>
      </svg>

      <span className="text-[11px] font-semibold text-slate-200 tracking-wide truncate flex-1">
        {stream ? stream.name : 'Unassigned'}
      </span>

      {nodeType && (
        <span className="text-[9px] font-bold tracking-widest text-slate-500 flex-shrink-0">
          {NODE_TYPE_LABELS[nodeType] ?? nodeType.toUpperCase()}
        </span>
      )}

      {/* Color picker — waveform only */}
      {nodeType === 'waveform' && onColorChange && (
        <label className="cursor-pointer flex-shrink-0" title="Trace color">
          <input
            type="color"
            value={lineColor || '#07dd96'}
            onChange={e => onColorChange(e.target.value)}
            className="sr-only"
          />
          <span
            className="block w-3 h-3 border border-slate-600 hover:border-slate-400 transition-colors"
            style={{ backgroundColor: lineColor || '#07dd96' }}
          />
        </label>
      )}

      <button
        onClick={onRemove}
        onMouseDown={e => e.stopPropagation()} // don't trigger drag
        className="text-slate-600 hover:text-red-500 transition-colors text-xs leading-none flex-shrink-0 font-mono"
        aria-label="Remove monitor"
      >
        ✕
      </button>
    </div>

    {/* Body */}
    <div className="flex-1 min-h-0 overflow-hidden">{children}</div>

    {/* Footer */}
    <div className="flex items-center justify-between px-2 py-0.5 border-t border-slate-700 bg-slate-800 flex-shrink-0 select-none">
      <span
        title={latencyLabel}
        className="block w-2 h-2 rounded-full transition-colors duration-500"
        style={{ backgroundColor: latencyColor }}
      />
      <NodeResizeControl minWidth={200} minHeight={150} position="bottom-right" style={{ background: 'transparent', border: 'none', width: 'auto', height: 'auto', right: 0, bottom: 0 }}>
        <svg className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-se-resize transition-colors" viewBox="0 0 10 10" fill="currentColor">
          <circle cx="3" cy="9" r="1"/><circle cx="6" cy="9" r="1"/><circle cx="9" cy="9" r="1"/>
          <circle cx="6" cy="6" r="1"/><circle cx="9" cy="6" r="1"/>
          <circle cx="9" cy="3" r="1"/>
        </svg>
      </NodeResizeControl>
    </div>
  </div>
  );
};

export default Monitor;
