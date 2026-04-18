import { HashRouter, Routes, Route } from 'react-router-dom';
import { DevModeProvider } from './assets/context/DevModeContext';

import Navbar from './assets/components/Navbar';
import Dashboard from './assets/views/dashboard/Dashboard';
import Settings from './assets/views/settings/Settings';
import MachineLearning from './assets/views/ml/MachineLearning';
import Data from './assets/views/data/Data';

const App = () => (
  <HashRouter>
    <DevModeProvider>
      <div className="flex h-screen bg-gray-50">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/ml" element={<MachineLearning />} />
            <Route path="/data" element={<Data />} />
          </Routes>
        </div>
        <Navbar />
      </div>
    </DevModeProvider>
  </HashRouter>
);

export default App;
