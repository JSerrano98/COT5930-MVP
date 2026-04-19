const DashboardFooter = ({ monitors }) => (
  <footer className="flex items-center justify-between px-6 py-1.5 border-t border-slate-700 bg-slate-900 text-[11px] text-slate-500 font-mono flex-shrink-0">
    <span>ECHO v{__APP_VERSION__}</span>
    <span>{monitors.length} monitor{monitors.length !== 1 ? 's' : ''}</span>
  </footer>
);

export default DashboardFooter;
