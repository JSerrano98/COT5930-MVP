import { useAlerts } from '../context/AlertContext';

const ICONS = {
  error: (
    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4m0-4h.01" />
    </svg>
  ),
};

const STYLES = {
  error:   'bg-slate-900 border-red-500   text-red-400',
  warning: 'bg-slate-900 border-yellow-500 text-yellow-400',
  info:    'bg-slate-900 border-blue-500   text-blue-400',
};

const AlertOverlay = () => {
  const { alerts, dismiss } = useAlerts();

  if (!alerts.length) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: 320 }}
    >
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`pointer-events-auto flex gap-3 px-3 py-2.5 border-l-2 shadow-lg ${STYLES[alert.type] ?? STYLES.error}`}
          style={{ animation: 'slideIn 0.2s ease' }}
        >
          {ICONS[alert.type] ?? ICONS.error}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold leading-tight">{alert.title}</p>
            {alert.message && (
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{alert.message}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(alert.id)}
            className="text-slate-600 hover:text-slate-300 transition-colors text-xs leading-none flex-shrink-0 self-start mt-0.5"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default AlertOverlay;
