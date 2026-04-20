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
  data: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v5c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
      <path d="M3 10v5c0 1.657 4.03 3 9 3s9-1.343 9-3v-5" />
      <path d="M3 15v4c0 1.657 4.03 3 9 3s9-1.343 9-3v-4" />
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
    `flex items-center gap-3 px-3 py-3 text-sm rounded-lg transition-colors font-medium ${
      isActive
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
    }`;

  return (
    <nav
      className={`bg-slate-900 flex flex-col h-screen p-3 flex-shrink-0 overflow-hidden transition-all duration-300 ${
        collapsed ? 'w-[52px]' : 'w-52'
      }`}
    >
      {/* Toggle button */}
      <div className="flex items-center justify-end mb-4 pb-3 border-b border-slate-700/50 flex-shrink-0">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
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
      <div className="flex flex-col gap-2 flex-shrink-0">
        <NavLink to="/" className={linkClass} title="Dashboard">
          {icons.dashboard}
          {!collapsed && <span>Dashboard</span>}
        </NavLink>
        <NavLink to="/ml" className={linkClass} title="Machine Learning">
          {icons.ml}
          {!collapsed && <span>Machine Learning</span>}
        </NavLink>
        <NavLink to="/data" className={linkClass} title="Data">
          {icons.data}
          {!collapsed && <span>Data</span>}
        </NavLink>
      </div>

      {/* Dead space — dev consoles when devMode is on, spacer otherwise */}
      {devMode && !collapsed ? (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-700/50 flex-1 min-h-0">
          <BackendConsole />
        </div>
      ) : (
        <div className="flex-1 min-h-0" />
      )}

      {/* Settings pinned to bottom */}
      <div className="flex flex-col gap-1 flex-shrink-0 pt-2 border-t border-slate-700/50">
        <NavLink to="/settings" className={linkClass} title="Settings">
          {icons.settings}
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </nav>
  );
};

export default Navbar;

