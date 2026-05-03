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

  useEffect(() => {
    if (!window.echo) return;

    window.echo.onSessionStopped(() => {
      setSessionRunning(false);
      setSessionStarting(false);
      disconnectWs();
    });

    window.echo.sessionStatus().then(({ running }) => {
      if (running) {
        setSessionRunning(true);
        connectWs();
      }
    });
  }, []);

  return { sessionRunning, sessionStarting, startSession, stopSession };
};