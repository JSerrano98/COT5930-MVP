import { NavLink } from 'react-router-dom';
import BackendTerminal from './BackendTerminal';

const Navbar = ({ devMode }) => {
  const linkClass = ({ isActive }) =>
    `w-full px-4 py-3 text-sm rounded-lg transition-colors font-medium ${
      isActive
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
    }`;

  return (
    <nav className="w-52 bg-slate-900 flex flex-col h-screen p-3">
      {/* Logo */}
      <div className="h-24 flex items-center justify-center border-b border-slate-700/50 mb-4">
        <img src="logo.png" alt="logo" className="h-[80%] w-[80%] object-contain" />
      </div>

      {/* Nav Links */}
      <div className="flex flex-col gap-2">
        <NavLink to="/" className={linkClass}>Dashboard</NavLink>
        <NavLink to="/ml" className={linkClass}>Machine Learning</NavLink>
        <NavLink to="/data" className={linkClass}>Data</NavLink>
      </div>

      {devMode && (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-700/50">
          <BackendTerminal />
        </div>
      )}
      
      <div className="flex flex-col gap-1 mt-auto">
        <NavLink to="/settings" className={linkClass}>Settings</NavLink>
      </div>
    </nav>
  );
};

export default Navbar;
