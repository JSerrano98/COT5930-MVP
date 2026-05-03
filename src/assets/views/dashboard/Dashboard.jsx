import { useState, useEffect, useRef } from 'react';
import { SIGNAL_COLORS } from './constants';
import { useAlerts } from '../../context/AlertContext';
import DashboardCanvas from './DashboardCanvas';
import DashboardFooter from './DashboardFooter';
import DashboardNodePanel from './DashboardNodePanel';
import RecordingDialog from './RecordingDialog';
import { useDashboardWebSocket } from './websocket/useDashboardWebSocket';
import { useDashboardSession } from './websocket/useDashboardSession';
import { useDevMode } from '../../context/DevModeContext';

let _id = 0;
const uid = () => `mon_${++_id}_${Date.now()}`;



const Dashboard = () => {
  const [monitors, setMonitors] = useState([]);
  const [_recording, setRecording] = useState(false);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
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

  const { sessionRunning } =
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

  const handleSetRecording = (val, { intentional = false } = {}) => {
    if (!val && intentional) userStoppedRecording.current = true;
    setRecording(val);
  };

  // Called when the Record button is clicked
  const handleRecordClick = async () => {
    if (recording) {
      // Stop recording
      userStoppedRecording.current = true;
      let savedTo = '';
      if (isElectron && window.echo?.stopRecording) {
        const result = await window.echo.stopRecording();
        savedTo = result?.saved_to ?? '';
      } else {
        const result = await fetch('http://localhost:8000/record/stop', { method: 'POST' })
          .then((r) => r.json())
          .catch(() => ({}));
        savedTo = result?.saved_to ?? '';
      }
      handleSetRecording(false, { intentional: true });
      pushAlert({
        type: 'success',
        title: 'Recording Saved',
        message: savedTo ? `Saved to ${savedTo}` : 'Recording file was saved.',
      });
    } else {
      setShowRecordDialog(true);
    }
  };

  const handleRecordConfirm = () => {
    setShowRecordDialog(false);
    handleSetRecording(true);
  };

  const handleRecordCancel = () => {
    setShowRecordDialog(false);
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

  const addModelMonitor = () =>
    setMonitors((prev) => [
      ...prev,
      {
        id: uid(),
        nodeType: 'ml',
        stream: null,
        sensorUid: '',
        sensorName: '',
        sourceName: '',
        sourceNames: [],
        sourceType: '',
        modelPath: '',
        featureAliases: {},
        running: false,
      },
    ]);

  const addCsvReplayMonitor = () =>
    setMonitors((prev) => [
      ...prev,
      {
        id: uid(),
        nodeType: 'csvReplay',
        stream: null,
        replayUid: '',
        sensorName: '',
        csvPath: '',
        timestampColumn: 'timestamp',
        running: false,
        completed: false,
        savedTo: '',
      },
    ]);

  const removeMonitor = (id) => {
    const mon = monitors.find((m) => m.id === id);
    if (mon?.nodeType === 'ml' && mon.sensorUid) {
      fetch(`http://localhost:8000/ml-sensors/${mon.sensorUid}`, { method: 'DELETE' }).catch(() => {});
    }
    if (mon?.nodeType === 'csvReplay' && mon.replayUid) {
      fetch(`http://localhost:8000/csv-replays/${mon.replayUid}`, { method: 'DELETE' }).catch(() => {});
      if (mon.running) {
        handleSetRecording(false, { intentional: true });
      }
    }
    setMonitors((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMonitor = (id, patch) =>
    setMonitors((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));

  return (
    <div className="w-full h-screen bg-echo-base flex flex-col overflow-hidden">
      <style>{`
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2E4057; }
        ::-webkit-scrollbar-thumb:hover { background: #FF7A00; }
      `}</style>

      <div className="flex flex-1 overflow-hidden">
        <DashboardNodePanel
          monitors={monitors}
          streams={streams}
          onAdd={addMonitor}
          onAddModel={addModelMonitor}
          onAddCsvReplay={addCsvReplayMonitor}
          onRemove={removeMonitor}
          sessionRunning={sessionRunning}
          collapsed={panelCollapsed}
          onToggle={() => setPanelCollapsed(v => !v)}
          connected={connected}
          loading={loading}
          recording={recording}
          onRecordClick={handleRecordClick}
          onRefresh={refreshStreams}
        />

        <DashboardCanvas
          monitors={monitors}
          streams={streams}
          dataRef={dataRef}
          onRemove={removeMonitor}
          onUpdateMonitor={updateMonitor}
          onRecordingChange={handleSetRecording}
        />
      </div>

      <DashboardFooter monitors={monitors} />

      {showRecordDialog && (
        <RecordingDialog
          isElectron={isElectron}
          onConfirm={handleRecordConfirm}
          onCancel={handleRecordCancel}
        />
      )}
    </div>
  );
};

export default Dashboard;
