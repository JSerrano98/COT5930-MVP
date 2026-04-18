const StatusDot = ({ connected }) => (
  <div className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-emerald-600' : 'text-red-600'}`}>
    <span
      className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-red-500'}`}
    />
    {connected ? 'Connected' : 'Disconnected'}
  </div>
);

const DashboardHeader = ({
  connected, streams, loading, recording, setRecording,
  isElectron, sessionRunning, sessionStarting,
  startSession, stopSession, onRefresh, onAddMonitor,
}) => (
  <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-white flex-shrink-0">
    <div className="flex items-center gap-4">
      <h1 className="text-[15px] font-semibold tracking-wide text-slate-800 m-0">
        Monitoring Dashboard
      </h1>

      <StatusDot connected={connected} />

      {isElectron && (
        <button
          onClick={sessionRunning ? stopSession : startSession}
          disabled={sessionStarting}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer disabled:cursor-wait
            ${sessionRunning
              ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
              : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
            }`}
        >
          {sessionStarting ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" className="animate-spin">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
              </svg>
              Starting…
            </>
          ) : sessionRunning ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
              Stop Session
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 20,12 6,20"/>
              </svg>
              Start Session
            </>
          )}
        </button>
      )}

      <button
        onClick={() => setRecording((r) => !r)}
        disabled={!connected}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all
          ${!connected
            ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
            : recording
              ? 'bg-red-50 border-red-200 text-red-600 cursor-pointer hover:bg-red-100'
              : 'bg-slate-50 border-slate-200 text-slate-500 cursor-pointer hover:bg-slate-100'
          }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${recording ? 'bg-red-500 animate-pulse' : connected ? 'bg-slate-400' : 'bg-slate-200'}`} />
        {recording ? 'Recording' : 'Record'}
      </button>
    </div>

    <div className="flex items-center gap-2.5">
      <span className="text-xs text-slate-400 font-normal mr-1">
        {streams.length} stream{streams.length !== 1 ? 's' : ''} detected
      </span>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-all disabled:cursor-wait"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className={loading ? 'animate-spin' : ''}
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
        </svg>
        {loading ? 'Scanning…' : 'Refresh'}
      </button>

      <button
        onClick={onAddMonitor}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-800 text-white hover:bg-slate-700 hover:border-slate-700 transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Monitor
      </button>
    </div>
  </header>
);

export default DashboardHeader;
    <div style={{
      width: 7, height: 7, borderRadius: '50%',
      background: connected ? '#10b981' : '#ef4444',
      boxShadow: connected ? '0 0 6px rgba(16,185,129,0.4)' : '0 0 6px rgba(239,68,68,0.4)',
      animation: connected ? 'pulse 2s infinite' : 'none',
    }} />
    {connected ? 'Connected' : 'Disconnected'}
  </div>
);

const DashboardHeader = ({
  connected, streams, loading, recording, setRecording,
  isElectron, sessionRunning, sessionStarting,
  startSession, stopSession, onRefresh, onAddMonitor,
}) => (
  <header style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px',
    borderBottom: '1px solid #e2e8f0',
    background: '#ffffff',
    flexShrink: 0,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.02em', color: '#1e293b', margin: 0 }}>
        Monitoring Dashboard
      </h1>

      <StatusDot connected={connected} />

      {isElectron && (
        <button
          onClick={sessionRunning ? stopSession : startSession}
          disabled={sessionStarting}
          style={btnStyle(
            sessionRunning ? '#fef2f2' : '#f0fdf4',
            sessionRunning ? '#fecaca' : '#bbf7d0',
            sessionRunning ? '#dc2626' : '#15803d',
            { cursor: sessionStarting ? 'wait' : 'pointer' },
          )}
        >
          {sessionStarting ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
              </svg>
              Starting…
            </>
          ) : sessionRunning ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
              Stop Session
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 20,12 6,20"/>
              </svg>
              Start Session
            </>
          )}
        </button>
      )}

      <button
        onClick={() => setRecording((r) => !r)}
        disabled={!connected}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 7,
          background: recording ? '#fef2f2' : '#f8fafc',
          border: recording ? '1px solid #fecaca' : '1px solid #e2e8f0',
          color: recording ? '#dc2626' : connected ? '#475569' : '#cbd5e1',
          fontSize: 12, fontWeight: 500,
          fontFamily: 'Lexend, sans-serif',
          cursor: connected ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
      >
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: recording ? '#ef4444' : connected ? '#94a3b8' : '#e2e8f0',
          boxShadow: recording ? '0 0 8px rgba(239,68,68,0.5)' : 'none',
          animation: recording ? 'pulse 1.2s infinite' : 'none',
        }} />
        {recording ? 'Recording' : 'Record'}
      </button>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginRight: 4 }}>
        {streams.length} stream{streams.length !== 1 ? 's' : ''} detected
      </span>

      <button
        onClick={onRefresh}
        disabled={loading}
        style={btnStyle('#f8fafc', '#e2e8f0', '#475569', { cursor: loading ? 'wait' : 'pointer' })}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
        </svg>
        {loading ? 'Scanning…' : 'Refresh'}
      </button>

      <button
        onClick={onAddMonitor}
        style={btnStyle('#1e293b', '#1e293b', '#ffffff')}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.borderColor = '#334155'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#1e293b'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Monitor
      </button>
    </div>
  </header>
);

export default DashboardHeader;
