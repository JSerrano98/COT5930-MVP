const StatusDot = ({ connected }) => (
  <div className={`flex items-center gap-1.5 text-xs font-ui font-semibold tracking-widest uppercase ${
    connected ? 'text-echo-green' : 'text-red-400'
  }`}>
    <span className={`echo-circle w-2 h-2 ${
      connected
        ? 'bg-echo-green'
        : 'bg-red-500'
    }`}
    style={connected ? { boxShadow: '0 0 6px #FF7A00' } : {}}
    />
    {connected ? 'Connected' : 'Disconnected'}
  </div>
);

const DashboardHeader = ({
  connected, streams, loading, recording, onRecordClick,
  onRefresh
}) => (
  <header className="flex items-center justify-between px-6 py-3 border-b border-echo-border bg-echo-surface flex-shrink-0">
    <div className="flex items-center gap-4">
      <span className="font-title text-2xl tracking-[0.12em] text-white">DASHBOARD</span>
      <div className="w-px h-5 bg-echo-border" />
      <StatusDot connected={connected} />

      <button
        onClick={onRecordClick}
        disabled={!connected}
        className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed border ${
          recording
            ? 'border-red-500 text-red-400 bg-red-500/10'
            : 'border-echo-border text-echo-muted hover:border-echo-muted hover:text-white'
        }`}
      >
        <span className={`echo-circle w-2 h-2 ${
          recording ? 'bg-red-400' : 'bg-echo-dim'
        }`}
        style={recording ? { animation: 'echo-pulse 1.2s ease infinite' } : {}}
        />
        {recording ? 'Stop Recording' : 'Record'}
      </button>
    </div>

    <div className="flex items-center gap-3">
      <span className="text-[10px] text-echo-dim font-ui tracking-widest uppercase mr-1">
        {streams.length} stream{streams.length !== 1 ? 's' : ''}
      </span>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase border border-echo-border text-echo-muted hover:border-echo-muted hover:text-white transition-all disabled:opacity-60 disabled:cursor-wait"
      >
        {loading ? 'Scanning…' : 'Refresh'}
      </button>
    </div>
  </header>
);

export default DashboardHeader;
