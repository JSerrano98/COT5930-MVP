const DashboardFooter = ({ monitors }) => (
  <footer className="flex items-center justify-between px-6 py-1.5 border-t border-echo-border bg-echo-surface text-[10px] text-echo-dim font-ui tracking-widest uppercase flex-shrink-0">
    <span>ECHO v{__APP_VERSION__}</span>
    <span>{monitors.length} monitor{monitors.length !== 1 ? 's' : ''}</span>
  </footer>
);

export default DashboardFooter;
