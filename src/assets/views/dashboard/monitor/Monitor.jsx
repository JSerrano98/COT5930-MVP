import { useState, useEffect } from 'react';
import { NodeResizeControl } from 'reactflow';

const NODE_TYPE_LABELS = {
  waveform: 'WAVEFORM',
  stats: 'STATS',
  eda: 'EDA',
  emg: 'EMG',
  resp: 'RESP',
  temp: 'TEMP',
  csvReplay: 'CSV REPLAY',
};

const Monitor = ({ stream, nodeType, lineColor, onColorChange, onRemove, dataRef, children }) => {
  const [latencyMs, setLatencyMs] = useState(null);
  const streamRateHz = Number(stream?.rate ?? 0);
  const expectedIntervalMs = streamRateHz > 0 ? 1000 / streamRateHz : null;

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
    latencyMs === null ? '#475569' :
    expectedIntervalMs
      ? latencyMs < expectedIntervalMs * 1.5
        ? '#22c55e'
        : latencyMs < expectedIntervalMs * 3
          ? '#eab308'
          : '#ef4444'
      : latencyMs < 100
        ? '#22c55e'
        : latencyMs < 300
          ? '#eab308'
          : '#ef4444';

  const latencyLabel =
    latencyMs === null
      ? 'No data'
      : expectedIntervalMs
        ? latencyMs < expectedIntervalMs * 1.5
          ? `Good (${latencyMs} ms, ${(latencyMs / expectedIntervalMs).toFixed(2)}x period)`
          : latencyMs < expectedIntervalMs * 3
            ? `Fair (${latencyMs} ms, ${(latencyMs / expectedIntervalMs).toFixed(2)}x period)`
            : `Poor (${latencyMs} ms, ${(latencyMs / expectedIntervalMs).toFixed(2)}x period)`
        : latencyMs < 100
          ? `Good (${latencyMs} ms)`
          : latencyMs < 300
            ? `Fair (${latencyMs} ms)`
            : `Poor (${latencyMs} ms)`;

  return (
  <div className="flex flex-col bg-echo-surface border border-echo-border overflow-hidden w-full h-full">

    {/* Header - drag handle */}
    <div className="monitor-drag flex items-center gap-2 px-3 py-1.5 border-b border-echo-border bg-echo-surface flex-shrink-0 cursor-grab active:cursor-grabbing select-none">

      {/* Drag grip icon */}
      <svg className="w-3 h-3 text-echo-dim flex-shrink-0" fill="currentColor" viewBox="0 0 8 12">
        <circle cx="2" cy="2"  r="1"/><circle cx="6" cy="2"  r="1"/>
        <circle cx="2" cy="6"  r="1"/><circle cx="6" cy="6"  r="1"/>
        <circle cx="2" cy="10" r="1"/><circle cx="6" cy="10" r="1"/>
      </svg>

      <span className="text-[11px] font-semibold text-white tracking-wide truncate flex-1">
        {stream ? stream.name : 'Unassigned'}
      </span>

      {nodeType && (
        <span className="text-[9px] font-bold tracking-widest text-echo-dim flex-shrink-0">
          {NODE_TYPE_LABELS[nodeType] ?? nodeType.toUpperCase()}
        </span>
      )}

      {/* Color picker - waveform only */}
      {nodeType === 'waveform' && onColorChange && (
        <label className="cursor-pointer flex-shrink-0" title="Trace color">
          <input
            type="color"
            value={lineColor || '#07dd96'}
            onChange={e => onColorChange(e.target.value)}
            className="sr-only"
          />
          <span
            className="block w-3 h-3 border border-echo-border hover:border-echo-green transition-colors"
            style={{ backgroundColor: lineColor || '#07dd96' }}
          />
        </label>
      )}

      <button
        onClick={onRemove}
        onMouseDown={e => e.stopPropagation()} // don't trigger drag
        className="text-echo-dim hover:text-red-500 transition-colors text-xs leading-none flex-shrink-0 font-mono"
        aria-label="Remove monitor"
      >
        ✕
      </button>
    </div>

    {/* Body */}
    <div className="flex-1 min-h-0 overflow-hidden">{children}</div>

    {/* Footer */}
    <div className="flex items-center justify-between px-2 py-0.5 border-t border-echo-border bg-echo-surface flex-shrink-0 select-none">
      <span
        title={latencyLabel}
        className="block w-2 h-2 echo-circle transition-colors duration-500"
        style={{ backgroundColor: latencyColor }}
      />
      <NodeResizeControl minWidth={200} minHeight={150} position="bottom-right" style={{ background: 'transparent', border: 'none', width: 'auto', height: 'auto', right: 0, bottom: 0 }}>
        <svg className="w-3 h-3 text-echo-dim hover:text-white cursor-se-resize transition-colors" viewBox="0 0 10 10" fill="currentColor">
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
