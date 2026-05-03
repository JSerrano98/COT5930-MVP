import { useState, useCallback } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { DevModeProvider } from './assets/context/DevModeContext';
import { AlertProvider } from './assets/context/AlertContext';
import AlertOverlay from './assets/components/AlertOverlay';
import SplashScreen from './assets/components/SplashScreen';

import Navbar from './assets/components/Navbar';
import Dashboard from './assets/views/dashboard/Dashboard';
import Settings from './assets/views/settings/Settings';
import MachineLearning from './assets/views/ml/MachineLearning';

// Inner component so useLocation works inside HashRouter
const AppLayout = () => {
  const { pathname } = useLocation();
  const isDashboard = pathname === '/';
  const isML        = pathname === '/ml';

  return (
    <div className="flex h-screen bg-echo-base">
      <div className="flex-1 overflow-y-auto relative">
        {/* Dashboard is always mounted — visibility toggled so WS/state persists */}
        <div style={{ display: isDashboard ? 'flex' : 'none', width: '100%', height: '100%' }}>
          <Dashboard />
        </div>

        {/* ML mounts only on its route so startup doesn't block the dashboard render. */}
        {isML && (
          <div style={{ display: isML ? 'flex' : 'none', width: '100%', height: '100%' }}>
            <MachineLearning />
          </div>
        )}

        {/* Other routes render normally */}
        {!isDashboard && !isML && (
          <Routes>
            <Route path="/settings" element={<Settings />} />
          </Routes>
        )}
      </div>
      <Navbar />
    </div>
  );
};

const App = () => {
  const isElectron = Boolean(window.echo?.getStartupStatus);
  const [appReady, setAppReady] = useState(isElectron);
  const handleReady = useCallback(() => setAppReady(true), []);

  return (
    <HashRouter>
      <DevModeProvider>
        <AlertProvider>
          {!appReady ? (
            <SplashScreen onReady={handleReady} />
          ) : (
            <>
              <AlertOverlay />
              <AppLayout />
            </>
          )}
        </AlertProvider>
      </DevModeProvider>
    </HashRouter>
  );
};

export default App;
