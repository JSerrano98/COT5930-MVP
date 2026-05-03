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

  const prevConnected    = useRef(false);
  const prevSessionRun   = useRef(false);
  const prevRecording    = useRef(false);
  const userStoppedSession   = useRef(false);
  const userStoppedRecording = useRef(false);

  const { connected, streams, loading, dataRef, connectWs, disconnectWs, refreshStreams } =
    useDashboardWebSocket();

  const { sessionRunning } =
    useDashboardSession({ connectWs, disconnectWs, setBackendLogs });

  const recording = connected ? _recording : false;

  useEffect(() => {
    const wasConnected  = prevConnected.current;
    const wasSession    = prevSessionRun.current;
    const wasRecording  = prevRecording.current;

    if (wasConnected && !connected) {
      pushAlert({ type: 'error', title: 'Sensor Connection Lost', message: 'WebSocket disconnected. Attempting to reconnect…' });
    }

    if (wasSession && !sessionRunning && !userStoppedSession.current) {
      pushAlert({ type: 'error', title: 'Session Dropout', message: 'The session ended unexpectedly.' });
    }
    userStoppedSession.current = false;

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

  const handleRecordClick = async () => {
    if (recording) {
      userStoppedRecording.current = true;
      const result = await window.echo.stopRecording();
      const savedTo = result?.saved_to ?? '';
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

  const stopMonitorRuntime = async (mon) => {
    if (mon?.nodeType === 'ml' && mon.sensorUid) {
      try {
        await fetch(`http://localhost:8000/ml-sensors/${mon.sensorUid}`, { method: 'DELETE' });
      } catch { /* ignore */ }
    }
    if (mon?.nodeType === 'csvReplay' && mon.replayUid) {
      try {
        await fetch(`http://localhost:8000/csv-replays/${mon.replayUid}`, { method: 'DELETE' });
      } catch { /* ignore */ }
    }
  };

  const normalizeLoadedMonitor = (mon, idx) => {
    const next = {
      ...mon,
      id: uid(),
      color: mon.color || SIGNAL_COLORS[idx % SIGNAL_COLORS.length],
      featureAliases: mon.featureAliases || {},
      sourceNames: Array.isArray(mon.sourceNames) ? mon.sourceNames : (mon.sourceName ? [mon.sourceName] : []),
    };

    if (mon?.stream?.name) {
      const found = streams.find((s) => s.name === mon.stream.name);
      next.stream = found || mon.stream;
    }

    if (next.nodeType === 'ml') {
      next.running = false;
      next.sensorUid = '';
      next.stream = null;
    }
    if (next.nodeType === 'csvReplay') {
      next.running = false;
      next.completed = false;
      next.replayUid = '';
      next.stream = null;
      next.savedTo = '';
    }

    return next;
  };

  const getWorkspaceDir = async () => {
    const configured = localStorage.getItem('echo_workspaces_dir');
    if (configured?.trim()) return configured;
    const fallback = await window.echo.getDefaultWorkspacePath();
    if (fallback) {
      localStorage.setItem('echo_workspaces_dir', fallback);
      return fallback;
    }
    return '';
  };

  const saveWorkspace = async () => {
    const name = window.prompt?.('Workspace file name', `workspace_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`);
    if (!name) return;

    const directory = await getWorkspaceDir();
    const payload = {
      app: 'ECHO',
      type: 'dashboard_workspace',
      monitors,
    };
    const result = await window.echo.saveDashboardWorkspace({ directory, name, workspace: payload });
    if (result?.ok) {
      pushAlert({ type: 'success', title: 'Workspace Saved', message: `Saved to ${result.path}` });
    } else {
      pushAlert({ type: 'error', title: 'Save Failed', message: result?.error || 'Could not save workspace JSON.' });
    }
  };

  const loadWorkspace = async () => {
    const directory = await getWorkspaceDir();
    const picked = await window.echo.pickFile({
      defaultPath: directory || undefined,
      filters: [{ name: 'Dashboard Workspaces', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (!picked) return;

    const loaded = await window.echo.loadDashboardWorkspace(picked);
    if (!loaded?.ok) {
      pushAlert({ type: 'error', title: 'Load Failed', message: loaded?.error || 'Could not parse workspace JSON.' });
      return;
    }

    const nextMonitorsRaw = Array.isArray(loaded.workspace?.monitors) ? loaded.workspace.monitors : null;
    if (!nextMonitorsRaw) {
      pushAlert({ type: 'error', title: 'Invalid Workspace', message: 'JSON does not contain a monitors array.' });
      return;
    }

    await Promise.all(monitors.map(stopMonitorRuntime));
    const next = nextMonitorsRaw.map((m, i) => normalizeLoadedMonitor(m, i));
    setMonitors(next);
    pushAlert({ type: 'success', title: 'Workspace Loaded', message: `Loaded ${next.length} monitor(s).` });
  };

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

        <div className="relative flex-1 overflow-hidden">
          <DashboardCanvas
            monitors={monitors}
            streams={streams}
            dataRef={dataRef}
            onRemove={removeMonitor}
            onUpdateMonitor={updateMonitor}
            onRecordingChange={handleSetRecording}
          />

          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
            <button
              onClick={saveWorkspace}
              title="Save dashboard workspace"
              className="px-3 py-1.5 text-[9px] font-ui font-semibold tracking-widest uppercase border border-echo-border bg-echo-surface/90 text-echo-muted hover:border-echo-muted hover:text-white transition-colors"
            >
              Save
            </button>
            <button
              onClick={loadWorkspace}
              title="Load dashboard workspace"
              className="px-3 py-1.5 text-[9px] font-ui font-semibold tracking-widest uppercase border border-echo-border bg-echo-surface/90 text-echo-muted hover:border-echo-muted hover:text-white transition-colors"
            >
              Load
            </button>
          </div>
        </div>
      </div>

      <DashboardFooter monitors={monitors} />

      {showRecordDialog && (
        <RecordingDialog
          onConfirm={handleRecordConfirm}
          onCancel={handleRecordCancel}
        />
      )}
    </div>
  );
};

export default Dashboard;