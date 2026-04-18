import { useState, useEffect } from 'react';
import { SIGNAL_COLORS } from './DashboardMonitor';
import DashboardHeader from './DashboardHeader';
import DashboardGrid from './DashboardGrid';
import DashboardFooter from './DashboardFooter';
import { useDashboardWebSocket } from './useDashboardWebSocket';
import { useDashboardSession } from './useDashboardSession';
import { useDevMode } from '../../context/DevModeContext';

let _id = 0;
const uid = () => `mon_${++_id}_${Date.now()}`;



const Dashboard = () => {
  const [monitors, setMonitors] = useState([]);
  const [_recording, setRecording] = useState(false);

  const { setBackendLogs } = useDevMode();
  const isElectron = !!window.echo;

  const { connected, streams, loading, dataRef, connectWs, disconnectWs, refreshStreams } =
    useDashboardWebSocket();

  const { sessionRunning, sessionStarting, startSession, stopSession } =
    useDashboardSession({ connectWs, disconnectWs, setBackendLogs });

  // Reset recording when WebSocket drops — derive from connected rather than an effect
  const recording = connected ? _recording : false;

  // Auto-connect WebSocket when not running inside Electron
  useEffect(() => {
    if (!isElectron) connectWs();
    return () => { if (!isElectron) disconnectWs(); };
  }, [connectWs, disconnectWs, isElectron]);

  const addMonitor = () =>
    setMonitors((prev) => [
      ...prev,
      { id: uid(), color: SIGNAL_COLORS[prev.length % SIGNAL_COLORS.length] },
    ]);

  const removeMonitor = (id) =>
    setMonitors((prev) => prev.filter((m) => m.id !== id));

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: '#f1f5f9',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Lexend, sans-serif',
      color: '#1e293b',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <DashboardHeader
        connected={connected}
        streams={streams}
        loading={loading}
        recording={recording}
        setRecording={setRecording}
        isElectron={isElectron}
        sessionRunning={sessionRunning}
        sessionStarting={sessionStarting}
        startSession={startSession}
        stopSession={stopSession}
        onRefresh={refreshStreams}
        onAddMonitor={addMonitor}
      />

      <DashboardGrid
        monitors={monitors}
        streams={streams}
        dataRef={dataRef}
        onRemove={removeMonitor}
        isElectron={isElectron}
        sessionRunning={sessionRunning}
      />

      <DashboardFooter monitors={monitors} />
    </div>
  );
};

export default Dashboard;
