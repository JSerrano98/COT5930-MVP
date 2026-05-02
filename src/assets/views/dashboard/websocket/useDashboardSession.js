import { useState, useCallback, useEffect } from 'react';

export const useDashboardSession = ({ connectWs, disconnectWs, setBackendLogs }) => {
  const [sessionRunning, setSessionRunning] = useState(false);
  const [sessionStarting, setSessionStarting] = useState(false);

  const startSession = useCallback(async () => {
    if (!window.echo) return;
    setSessionStarting(true);

    const result = await window.echo.startSession();
    if (result.ok) {
      setSessionRunning(true);
      connectWs();
      setSessionStarting(false);
    } else {
      setSessionStarting(false);
      setBackendLogs((prev) => [...prev, `Error: ${result.error}`]);
    }
  }, [connectWs, setBackendLogs]);

  const stopSession = useCallback(async () => {
    if (!window.echo) return;
    await window.echo.stopSession();
    setSessionRunning(false);
    disconnectWs();
  }, [disconnectWs]);

  // Set up Electron IPC listeners once on mount
  useEffect(() => {
    if (!window.echo) return;

    window.echo.onSessionStopped(() => {
      setSessionRunning(false);
      setSessionStarting(false);
      disconnectWs();
    });

    // Session was already started by the main process during startup.
    // Just check its status and connect WS — don't auto-start again.
    window.echo.sessionStatus().then(({ running }) => {
      if (running) {
        setSessionRunning(true);
        connectWs();
      }
      // If somehow not running (e.g. session failed), user can start manually.
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sessionRunning, sessionStarting, startSession, stopSession };
};
