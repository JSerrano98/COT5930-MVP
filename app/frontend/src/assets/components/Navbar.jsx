import { NavLink } from 'react-router-dom';

const Navbar = () => {
  const linkClass = ({ isActive }) =>
    `w-full px-4 py-3 text-sm rounded-lg transition-colors ${
      isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
    }`;

  return (
    <nav className="w-48 bg-neutral-900 flex flex-col h-screen p-3">
      {/* Logo */}
      <div className="h-24 flex items-center justify-center border-b border-neutral-800 mb-4">
        <img src="logo.png" alt="logo" className="h-[80%] w-[80%] object-contain" />
      </div>

      {/* Nav Links */}
      <div className="flex flex-col gap-5">
        <NavLink to="/" className={linkClass}>Dashboard</NavLink>
        <NavLink to="/machine-learning" className={linkClass}>Machine Learning</NavLink>
        <NavLink to="/data" className={linkClass}>Data</NavLink>
      </div>
      
      <div className="flex flex-col gap-1 mt-auto">
        <NavLink to="/settings" className={linkClass}>Settings</NavLink>
      </div>
    </nav>
  );
};

export default Navbar;