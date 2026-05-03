import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import BackendConsole from './BackendConsole';
import { useDevMode } from '../context/DevModeContext';

const icons = {
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  ml: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.636 5.636l2.121 2.121M16.243 16.243l2.121 2.121M5.636 18.364l2.121-2.121M16.243 7.757l2.121-2.121" />
    </svg>
  ),
  settings: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const Navbar = () => {
  const { devMode } = useDevMode();
  const [collapsed, setCollapsed] = useState(false);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 text-xs tracking-widest uppercase transition-colors font-ui border-l-2 ${
      isActive
        ? 'border-l-echo-green bg-echo-surface-2 text-white'
        : 'border-l-transparent text-echo-muted hover:text-white hover:bg-echo-surface-2 hover:border-l-echo-green'
    }`;

  return (
    <nav
      className={`bg-echo-surface flex flex-col h-screen p-2 flex-shrink-0 overflow-hidden transition-all duration-300 border-r border-echo-border border-l-2 border-l-echo-green/40 ${collapsed ? 'w-[70px]' : 'w-48'}`}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end mb-4 pb-3 border-b border-echo-border flex-shrink-0 px-1">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-center p-1.5 text-echo-dim hover:text-white transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Nav Links */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        <NavLink to="/" className={linkClass} title="Dashboard">
          {icons.dashboard}
          {!collapsed && <span>Dashboard</span>}
        </NavLink>
        <NavLink to="/ml" className={linkClass} title="Machine Learning">
          {icons.ml}
          {!collapsed && <span>Machine Learning</span>}
        </NavLink>
      </div>

      {/* Dead space - dev consoles when devMode is on, spacer otherwise */}
      {devMode && !collapsed ? (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-echo-border flex-1 min-h-0">
          <BackendConsole />
        </div>
      ) : (
        <div className="flex-1 min-h-0" />
      )}

      {/* Settings pinned to bottom */}
      <div className="flex flex-col gap-1 flex-shrink-0 pt-2 border-t border-echo-border">
        <NavLink to="/settings" className={linkClass} title="Settings">
          {icons.settings}
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </nav>
  );
};

export default Navbar;

