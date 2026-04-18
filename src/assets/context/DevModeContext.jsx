import { createContext, useContext, useState, useEffect, useRef } from 'react';

const DevModeContext = createContext(null);

export const DevModeProvider = ({ children }) => {
  const [devMode, setDevMode] = useState(false);
  const [backendLogs, setBackendLogs] = useState([]);
  const listenerAttached = useRef(false);

  useEffect(() => {
    if (!window.echo || listenerAttached.current) return;
    listenerAttached.current = true;

    window.echo.onBackendLog((msg) => {
      setBackendLogs((prev) => {
        const next = [...prev, msg.trim()];
        return next.length > 500 ? next.slice(-500) : next;
      });
    });
  }, []);

  return (
    <DevModeContext.Provider value={{ devMode, setDevMode, backendLogs, setBackendLogs }}>
      {children}
    </DevModeContext.Provider>
  );
};

export const useDevMode = () => useContext(DevModeContext);
