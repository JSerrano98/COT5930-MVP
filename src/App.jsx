import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { DevModeProvider } from './assets/context/DevModeContext';
import { AlertProvider } from './assets/context/AlertContext';
import AlertOverlay from './assets/components/AlertOverlay';

import Navbar from './assets/components/Navbar';
import Dashboard from './assets/views/dashboard/Dashboard';
import Settings from './assets/views/settings/Settings';
import MachineLearning from './assets/views/ml/MachineLearning';
import Data from './assets/views/data/Data';

// Inner component so useLocation works inside HashRouter
const AppLayout = () => {
  const { pathname } = useLocation();
  const isDashboard = pathname === '/';

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-1 overflow-y-auto relative">
        {/* Dashboard is always mounted — visibility toggled so WS/state persists */}
        <div style={{ display: isDashboard ? 'flex' : 'none', width: '100%', height: '100%' }}>
          <Dashboard />
        </div>

        {/* Other routes render normally on top when active */}
        {!isDashboard && (
          <Routes>
            <Route path="/settings" element={<Settings />} />
            <Route path="/ml" element={<MachineLearning />} />
            <Route path="/data" element={<Data />} />
          </Routes>
        )}
      </div>
      <Navbar />
    </div>
  );
};

const App = () => (
  <HashRouter>
    <DevModeProvider>
      <AlertProvider>
        <AlertOverlay />
        <AppLayout />
      </AlertProvider>
    </DevModeProvider>
  </HashRouter>
);

export default App;
