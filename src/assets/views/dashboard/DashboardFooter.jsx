const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.1.4';

const DashboardFooter = ({ monitors }) => (
  <footer className="flex items-center justify-between px-6 py-1.5 border-t border-echo-border bg-echo-surface text-[10px] text-echo-dim font-ui tracking-widest uppercase flex-shrink-0">
    <span>ECHO v{APP_VERSION}</span>
    <span>{monitors.length} monitor{monitors.length !== 1 ? 's' : ''}</span>
  </footer>
);

export default DashboardFooter;
