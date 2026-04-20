import { createContext, useContext, useState, useEffect, useRef } from 'react';

const DevModeContext = createContext(null);

export const DevModeProvider = ({ children }) => {
  const [devMode, setDevMode] = useState(false);
  const [backendLogs, setBackendLogs] = useState([]);
  const listenerAttached = useRef(false);

  useEffect(() => {
    // window.echo is injected by Electron's preload; retry once if not yet ready
    const attach = () => {
      if (listenerAttached.current || !window.echo) return false;
      listenerAttached.current = true;
      window.echo.onBackendLog((line) => {
        setBackendLogs((prev) => {
          const next = [...prev, line.trim()];
          return next.length > 500 ? next.slice(-500) : next;
        });
      });
      return true;
    };

    if (!attach()) {
      const t = setTimeout(attach, 500);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <DevModeContext.Provider value={{ devMode, setDevMode, backendLogs, setBackendLogs }}>
      {children}
    </DevModeContext.Provider>
  );
};

export const useDevMode = () => useContext(DevModeContext);
