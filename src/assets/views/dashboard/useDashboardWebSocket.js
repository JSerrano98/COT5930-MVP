import { useState, useRef, useCallback, useEffect } from 'react';

const WS_URL = 'ws://localhost:8000/ws';
const API_URL = 'http://localhost:8000';

export const useDashboardWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);
  const dataRef = useRef({});
  const reconnectTimer = useRef(null);
  const manualDisconnect = useRef(false);

  const fetchStreams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/streams`);
      if (res.ok) setStreams(await res.json());
    } catch { /* server may not be up yet */ }
    setLoading(false);
  }, []);

  const refreshStreams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/refresh`, { method: 'POST' });
      if (res.ok) setStreams(await res.json());
    } catch { /* server may not be up yet */ }
    setLoading(false);
  }, []);

  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    manualDisconnect.current = false;

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnected(true);
        fetchStreams();
      };

      ws.onmessage = (evt) => {
        try {
          const pkt = JSON.parse(evt.data);
          const name = pkt.stream;
          if (!dataRef.current[name]) dataRef.current[name] = [];
          dataRef.current[name].push(pkt);
          if (dataRef.current[name].length > 600)
            dataRef.current[name] = dataRef.current[name].slice(-300);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!manualDisconnect.current)
          reconnectTimer.current = setTimeout(connectWs, 2000);
      };

      ws.onerror = () => ws.close();
      wsRef.current = ws;
    } catch {
      reconnectTimer.current = setTimeout(connectWs, 2000);
    }
  }, [fetchStreams]);

  const disconnectWs = useCallback(() => {
    manualDisconnect.current = true;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (wsRef.current) wsRef.current.close();
  }, []);

  // Drain stale data buffer
  useEffect(() => {
    const interval = setInterval(() => {
      for (const key in dataRef.current) {
        if (dataRef.current[key].length > 2000)
          dataRef.current[key] = dataRef.current[key].slice(-1000);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return { connected, streams, loading, dataRef, connectWs, disconnectWs, refreshStreams };
};
