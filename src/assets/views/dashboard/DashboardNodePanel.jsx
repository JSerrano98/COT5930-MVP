const NODE_TYPES = [
  { key: 'waveform', label: 'Waveform' },
  { key: 'stats',    label: 'Stats' },
];

const groupByType = (streams) =>
  streams.reduce((acc, s) => {
    const key = s.type || 'Unknown';
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

const DashboardNodePanel = ({ streams = [], monitors = [], onAdd, onRemove, sessionRunning, collapsed = false, onToggle }) => {
  const groups = groupByType(streams);

  const countByStream = monitors.reduce((acc, m) => {
    if (m.stream) acc[m.stream.name] = (acc[m.stream.name] || 0) + 1;
    return acc;
  }, {});

  return (
    <aside className={`flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? 'w-8' : 'w-60'}`}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between px-2 py-3 border-b border-slate-700 flex-shrink-0">
        {!collapsed && (
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">Streams</span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto text-slate-500 hover:text-slate-200 transition-colors p-1 leading-none"
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Stream list */}
          <div className="flex-1 overflow-y-auto">
            {!sessionRunning ? (
              <p className="px-4 py-8 text-[11px] text-slate-600 font-mono text-center">
                Start a session to see streams
              </p>
            ) : streams.length === 0 ? (
              <p className="px-4 py-8 text-[11px] text-slate-600 font-mono text-center">
                No streams detected
              </p>
            ) : (
              Object.entries(groups).map(([type, typeStreams]) => (
                <div key={type} className="border-b border-slate-800 last:border-0">
                  <div className="px-4 py-1.5 bg-slate-800 border-b border-slate-700">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{type}</span>
                  </div>
                  {typeStreams.map((stream) => (
                    <div key={stream.name} className="px-3 py-2.5">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-300 truncate">{stream.name}</p>
                          <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                            {stream.channels}ch · {stream.rate}Hz
                          </p>
                        </div>
                        {countByStream[stream.name] > 0 && (
                          <span className="ml-1 mt-0.5 flex-shrink-0 text-[10px] bg-slate-700 text-slate-300 font-mono px-1.5 py-0.5">
                            {countByStream[stream.name]}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-px">
                        {NODE_TYPES.map((nt) => (
                          <button
                            key={nt.key}
                            onClick={() => onAdd(stream, nt.key)}
                            title={`Add ${nt.label} node for ${stream.name}`}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold tracking-wider bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                          >
                            {nt.label.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {monitors.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-700">
              <ul className="divide-y divide-slate-800">
                {monitors.map((mon) => (
                  <li key={mon.id} className="flex items-center gap-2 py-1.5 group">
                    <span className="flex-1 min-w-0 text-[11px] text-slate-400 font-mono truncate">
                      {mon.stream?.name ?? 'Unknown'}
                      <span className="ml-1 text-slate-400">· {mon.nodeType}</span>
                    </span>
                    <button
                      onClick={() => onRemove(mon.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all text-xs leading-none"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </aside>
  );
};

export default DashboardNodePanel;

