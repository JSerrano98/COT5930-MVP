import { useDevMode } from '../../context/DevModeContext';

const NODE_TYPES = [
  { key: 'waveform', label: 'Waveform', excludeType: 'HeartRate' },
  { key: 'stats', label: 'Stats' },
  { key: 'bpm', label: 'BPM', onlyType: 'HeartRate' },
  { key: 'eda', label: 'EDA', onlyType: 'EDA' },
  { key: 'emg', label: 'EMG', onlyType: 'EMG' },
  { key: 'resp', label: 'Resp', onlyType: 'Respiration' },
  { key: 'temp', label: 'Temp', onlyType: 'Temperature' },
];

const groupByType = (streams) =>
  streams.reduce((acc, s) => {
    const key = s.type || 'Unknown';
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

const DashboardNodePanel = ({ streams = [], monitors = [], onAdd, onAddModel, onAddCsvReplay, onRemove, sessionRunning, collapsed = false, onToggle, connected = false, loading = false, recording = false, onRecordClick, onRefresh }) => {
  const { devMode } = useDevMode();
  const groups = groupByType(streams);

  const countByStream = monitors.reduce((acc, m) => {
    if (m.stream) acc[m.stream.name] = (acc[m.stream.name] || 0) + 1;
    return acc;
  }, {});

  return (
    <aside className={`flex-shrink-0 bg-echo-surface border-r-2 border-r-echo-green/30 border-l border-l-echo-border flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? 'w-8' : 'w-60'}`}>
      {/* Header with toggle */}
      <div className="flex flex-col border-b border-echo-border flex-shrink-0">
        {/* Status / controls row */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-echo-border">
            {/* Connection dot */}
            <span className={`echo-circle w-2 h-2 flex-shrink-0 ${connected ? 'bg-echo-blue' : 'bg-red-500'}`}
              style={connected ? { backgroundColor: '#00C853', boxShadow: '0 0 6px #00C853' } : {}}
            />
            <span className="text-[9px] font-ui font-semibold tracking-widest uppercase flex-1 text-echo-muted">
              {connected ? 'Connected' : 'No Signal'}
            </span>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="text-[9px] font-ui font-semibold tracking-widest uppercase text-echo-dim hover:text-white disabled:opacity-40 transition-colors"
            >
              {loading ? '…' : 'Refresh'}
            </button>
          </div>
        )}
        {/* Streams label / record / collapse row */}
        <div className="flex items-center justify-between px-2 py-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={onRecordClick}
                disabled={!connected}
                className={`flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-ui font-semibold tracking-widest uppercase border transition-colors disabled:opacity-40 ${
                  recording
                    ? 'border-red-500/60 bg-red-500/10 text-red-400'
                    : 'border-echo-border text-echo-dim hover:border-echo-muted hover:text-white'
                }`}
              >
                <span className={`echo-circle w-1.5 h-1.5 ${recording ? 'bg-red-400' : 'bg-echo-dim'}`}
                  style={recording ? { animation: 'echo-pulse 1.2s ease infinite' } : {}}
                />
                {recording ? 'Stop' : 'Record'}
              </button>
              <button
                onClick={onAddModel}
                title="Add ML model monitor"
                className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-ui font-semibold tracking-widest uppercase border border-echo-border text-echo-dim hover:border-echo-muted hover:text-white transition-colors"
              >
                + ML
              </button>
              {devMode && (
                <button
                  onClick={onAddCsvReplay}
                  title="Add CSV replay monitor"
                  className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-ui font-semibold tracking-widest uppercase border border-echo-border text-echo-dim hover:border-echo-muted hover:text-white transition-colors"
                >
                  + CSV Replay
                </button>
              )}
            </div>
          )}
          <button
            onClick={onToggle}
            className="ml-auto text-echo-dim hover:text-white transition-colors p-1 leading-none font-ui"
            title={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Stream list */}
          <div className="flex-1 overflow-y-auto">
            {!sessionRunning ? (
              <p className="px-4 py-8 text-[10px] text-echo-dim font-ui tracking-widest uppercase text-center">
                Start a session to see streams
              </p>
            ) : streams.length === 0 ? (
              <p className="px-4 py-8 text-[10px] text-echo-dim font-ui tracking-widest uppercase text-center">
                No streams detected
              </p>
            ) : (
              Object.entries(groups).map(([type, typeStreams]) => (
                <div key={type} className="border-b border-echo-border-2 last:border-0">
                  <div className="px-4 py-1.5 bg-echo-surface-2 border-b border-echo-border">
                    <span className="text-[9px] font-ui font-bold text-echo-dim uppercase tracking-widest">{type}</span>
                  </div>
                  {typeStreams.map((stream) => (
                    <div key={stream.name} className="px-3 py-2.5 border-b border-echo-border-2">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-ui font-semibold text-white truncate">{stream.name}</p>
                          <p className="text-[10px] text-echo-dim font-body mt-0.5">
                            {stream.channels}ch · {stream.rate}Hz
                          </p>
                        </div>
                        {countByStream[stream.name] > 0 && (
                          <span className="ml-1 mt-0.5 flex-shrink-0 text-[9px] bg-echo-border text-echo-muted font-ui font-semibold tracking-widest px-1.5 py-0.5">
                            {countByStream[stream.name]}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-px">
                        {NODE_TYPES.filter((nt) => (!nt.onlyType || nt.onlyType === stream.type) && (!nt.excludeType || nt.excludeType !== stream.type)).map((nt) => (
                          <button
                            key={nt.key}
                            onClick={() => onAdd(stream, nt.key)}
                            title={`Add ${nt.label} node for ${stream.name}`}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-ui font-semibold tracking-widest uppercase bg-echo-surface-2 text-echo-muted hover:bg-echo-border hover:text-white transition-colors border border-echo-border"
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
            <div className="px-3 py-2 border-t border-echo-border">
              <ul className="divide-y divide-echo-border-2">
                {monitors.map((mon) => (
                  <li key={mon.id} className="flex items-center gap-2 py-1.5 group">
                    <span className="flex-1 min-w-0 text-[10px] text-echo-muted font-ui truncate">
                      {mon.stream?.name ?? mon.sensorName ?? 'ML Model'}
                      <span className="ml-1 text-echo-dim">· {mon.nodeType}</span>
                    </span>
                    <button
                      onClick={() => onRemove(mon.id)}
                      className="opacity-0 group-hover:opacity-100 text-echo-dim hover:text-red-400 transition-all text-xs leading-none font-ui"
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

