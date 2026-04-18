import { NavLink } from 'react-router-dom';
import BackendConsole from './BackendConsole';
import FrontendConsole from './FrontendConsole';
import { useDevMode } from '../context/DevModeContext';

const Navbar = () => {
  const { devMode } = useDevMode();

  const linkClass = ({ isActive }) =>
    `w-full px-4 py-3 text-sm rounded-lg transition-colors font-medium ${
      isActive
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
    }`;

  return (
    <nav className="w-52 bg-slate-900 flex flex-col h-screen p-3 flex-shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="h-24 flex items-center justify-center border-b border-slate-700/50 mb-4 flex-shrink-0">
        <img src="logo.png" alt="logo" className="h-[80%] w-[80%] object-contain" />
      </div>

      {/* Nav Links */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        <NavLink to="/" className={linkClass}>Dashboard</NavLink>
        <NavLink to="/ml" className={linkClass}>Machine Learning</NavLink>
        <NavLink to="/data" className={linkClass}>Data</NavLink>
      </div>

      {/* Dead space — dev consoles when devMode is on, spacer otherwise */}
      {devMode ? (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-700/50 flex-1 min-h-0">
          <BackendConsole />
          <FrontendConsole />
        </div>
      ) : (
        <div className="flex-1 min-h-0" />
      )}

      {/* Settings pinned to bottom */}
      <div className="flex flex-col gap-1 flex-shrink-0 pt-2 border-t border-slate-700/50">
        <NavLink to="/settings" className={linkClass}>Settings</NavLink>
      </div>
    </nav>
  );
};

export default Navbar;

