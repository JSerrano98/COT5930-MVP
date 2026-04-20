import { createContext, useContext, useState, useCallback, useRef } from 'react';

const AlertContext = createContext(null);

let _seq = 0;

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const pushAlert = useCallback(({ type = 'error', title, message, ttl = 8000 }) => {
    const id = `alert_${++_seq}`;
    setAlerts(prev => {
      // Deduplicate by title — don't stack the same alert repeatedly
      if (prev.some(a => a.title === title)) return prev;
      return [...prev, { id, type, title, message }];
    });
    if (ttl > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), ttl);
    }
    return id;
  }, [dismiss]);

  return (
    <AlertContext.Provider value={{ alerts, pushAlert, dismiss }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertProvider');
  return ctx;
};
