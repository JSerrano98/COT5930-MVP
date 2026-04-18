import MonitorPanel from './DashboardMonitor';

const DashboardGrid = ({ monitors, streams, dataRef, onRemove, isElectron, sessionRunning }) => (
  <div className="flex-1 overflow-auto p-5">
    {monitors.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-full gap-3.5 opacity-45">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1" strokeLinecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
          <polyline points="6 10 9 7 12 11 15 8 18 12" strokeWidth="1.5"/>
        </svg>
        <div className="text-center">
          <div className="text-sm font-medium mb-1 text-slate-600">No monitors active</div>
          <div className="text-xs text-slate-400">
            {isElectron && !sessionRunning
              ? <><strong>Start Session</strong> to launch the backend, then <strong>Add Monitor</strong></>
              : <><strong>Add Monitor</strong> to start watching a signal stream</>
            }
          </div>
        </div>
      </div>
    ) : (
      <div className="flex flex-wrap gap-3.5 content-start">
        {monitors.map((m) => (
          <div key={m.id} style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <MonitorPanel
              id={m.id}
              streams={streams}
              dataRef={dataRef}
              onRemove={onRemove}
              defaultColor={m.color}
            />
          </div>
        ))}
      </div>
    )}
  </div>
);

export default DashboardGrid;
