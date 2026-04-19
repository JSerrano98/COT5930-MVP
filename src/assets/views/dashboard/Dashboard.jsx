import { useState, useEffect, useRef } from 'react';
import { SIGNAL_COLORS } from './constants';
import { useAlerts } from '../../context/AlertContext';
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
  const { pushAlert } = useAlerts();
  const isElectron = !!window.echo;

  // Track previous values to detect unexpected drops
  const prevConnected    = useRef(false);
  const prevSessionRun   = useRef(false);
  const prevRecording    = useRef(false);
  const userStoppedSession   = useRef(false);
  const userStoppedRecording = useRef(false);

  const { connected, streams, loading, dataRef, connectWs, disconnectWs, refreshStreams } =
    useDashboardWebSocket();

  const { sessionRunning, sessionStarting, startSession, stopSession } =
    useDashboardSession({ connectWs, disconnectWs, setBackendLogs });

  // Reset recording when WebSocket drops — derive from connected rather than an effect
  const recording = connected ? _recording : false;

  // Dropout detection
  useEffect(() => {
    const wasConnected  = prevConnected.current;
    const wasSession    = prevSessionRun.current;
    const wasRecording  = prevRecording.current;

    // Sensor connection dropped
    if (wasConnected && !connected) {
      pushAlert({ type: 'error', title: 'Sensor Connection Lost', message: 'WebSocket disconnected. Attempting to reconnect…' });
    }

    // Session dropped unexpectedly (not by user)
    if (wasSession && !sessionRunning && !userStoppedSession.current) {
      pushAlert({ type: 'error', title: 'Session Dropout', message: 'The session ended unexpectedly.' });
    }
    userStoppedSession.current = false;

    // Recording dropped unexpectedly (not by user)
    if (wasRecording && !recording && !userStoppedRecording.current) {
      pushAlert({ type: 'warning', title: 'Recording Interrupted', message: 'Recording stopped due to a connection dropout.' });
    }
    userStoppedRecording.current = false;

    prevConnected.current  = connected;
    prevSessionRun.current = sessionRunning;
    prevRecording.current  = recording;
  }, [connected, sessionRunning, recording, pushAlert]);

  // Wrapped stop handlers that mark the stop as user-initiated
  const handleStopSession = () => {
    userStoppedSession.current = true;
    stopSession();
  };
  const handleSetRecording = (val) => {
    if (!val) userStoppedRecording.current = true;
    setRecording(val);
  };

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
        setRecording={handleSetRecording}
        isElectron={isElectron}
        sessionRunning={sessionRunning}
        sessionStarting={sessionStarting}
        startSession={startSession}
        stopSession={handleStopSession}
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
