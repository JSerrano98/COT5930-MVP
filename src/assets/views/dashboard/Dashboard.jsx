import { useState, useEffect } from 'react';
import { SIGNAL_COLORS } from './constants';
import DashboardHeader from './DashboardHeader';
import DashboardCanvas from './DashboardCanvas';
import DashboardFooter from './DashboardFooter';
import DashboardNodePanel from './DashboardNodePanel';
import { useDashboardWebSocket } from './websocket/useDashboardWebSocket';
import { useDashboardSession } from './websocket/useDashboardSession';
import { useDevMode } from '../../context/DevModeContext';

let _id = 0;
const uid = () => `mon_${++_id}_${Date.now()}`;



const Dashboard = () => {
  const [monitors, setMonitors] = useState([]);
  const [_recording, setRecording] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

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

  const addMonitor = (stream, nodeType) =>
    setMonitors((prev) => [
      ...prev,
      { id: uid(), color: SIGNAL_COLORS[prev.length % SIGNAL_COLORS.length], nodeType, stream },
    ]);

  const removeMonitor = (id) =>
    setMonitors((prev) => prev.filter((m) => m.id !== id));

  const updateMonitor = (id, patch) =>
    setMonitors((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));

  return (
    <div className="w-full h-screen bg-slate-950 flex flex-col overflow-hidden">
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
      />

      <div className="flex flex-1 overflow-hidden">
        <DashboardNodePanel
          monitors={monitors}
          streams={streams}
          onAdd={addMonitor}
          onRemove={removeMonitor}
          sessionRunning={sessionRunning}
          collapsed={panelCollapsed}
          onToggle={() => setPanelCollapsed(v => !v)}
        />

        <DashboardCanvas
          monitors={monitors}
          dataRef={dataRef}
          onRemove={removeMonitor}
          onUpdateMonitor={updateMonitor}
        />
      </div>

      <DashboardFooter monitors={monitors} />
    </div>
  );
};

export default Dashboard;
