import { HashRouter, Routes, Route } from 'react-router-dom';
import Navbar from './assets/components/Navbar';
import Dashboard from './assets/views/Dashboard';
import Settings from './assets/views/Settings';
import MachineLearning from './assets/views/MachineLearning';
import Data from './assets/views/Data';
import React, { Component } from "react";


const App = () => {
  return (
    <HashRouter>
      <div className="flex h-screen">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/machine-learning" element={<MachineLearning />} />
            <Route path="/data" element={<Data />} />
          </Routes>
        </div>
        <Navbar />
      </div>
    </HashRouter>
  );
};

export default App;