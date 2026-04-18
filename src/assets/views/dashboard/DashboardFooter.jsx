const DashboardFooter = ({ monitors }) => (
  <footer className="flex items-center justify-between px-6 py-1.5 border-t border-slate-200 bg-white text-[11px] text-slate-400 font-normal flex-shrink-0">
    <span>ECHO v{__APP_VERSION__}</span>
    <span>{monitors.length} monitor{monitors.length !== 1 ? 's' : ''}</span>
  </footer>
);

export default DashboardFooter;
