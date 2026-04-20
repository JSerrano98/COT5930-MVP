const StatusDot = ({ connected }) => (
  <div className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
    <span
      className={`w-2 h-2 ${connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-red-500'}`}
    />
    {connected ? 'Connected' : 'Disconnected'}
  </div>
);

const DashboardHeader = ({
  connected, streams, loading, recording, setRecording,
  isElectron, sessionRunning, sessionStarting,
  startSession, stopSession, onRefresh
}) => (
  <header className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-900 flex-shrink-0">
    <div className="flex items-center gap-3">

      <StatusDot connected={connected} />

      {isElectron && (
        <button
          onClick={sessionRunning ? stopSession : startSession}
          disabled={sessionStarting}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-transparent border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-all disabled:opacity-60 disabled:cursor-wait"
        >
          {sessionStarting ? (
            <span className="text-yellow-400">Starting Up...</span>
          ) : sessionRunning ? (
            <span className="text-red-400">Stop Session</span>
          ) : (
            <span className="text-emerald-400">Start Session</span>
          )}
        </button>
      )}

      <button
        onClick={() => setRecording((r) => !r)}
        disabled={!connected}
        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-transparent border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className={`w-2 h-2 rounded-full ${recording ? 'bg-red-400' : 'bg-slate-400'}`} />
        {recording ? 'Recording' : 'Record'}
      </button>
    </div>

    <div className="flex items-center gap-2.5">
      <span className="text-xs text-slate-500 font-mono mr-1">
        {streams.length} stream{streams.length !== 1 ? 's' : ''}
      </span>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-transparent border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-all disabled:opacity-60 disabled:cursor-wait"
      >
        
        {loading ? 'Scanning…' : 'Refresh'}
      </button>

    </div>
  </header>
);

export default DashboardHeader;
