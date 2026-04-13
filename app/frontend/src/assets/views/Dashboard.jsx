import React, { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8000/ws';
const API_URL = 'http://localhost:8000';

const SIGNAL_COLORS = [
// chill easy to look at color pallet on dark backgrounds, with good contrast and variety for multiple channels
  '#2563eb', '#07dd96', '#ef4444', '#f5e50b',
  '#8b5cf6', '#59dff7', '#ec4899', '#8de40a',
  '#ff6a00', '#4f9bf1', '#14b8a6', '#e11d48',
];

const MIN_W = 320;
const MIN_H = 220;

/* Unique ID generator */
let _id = 0;
const uid = () => `mon_${++_id}_${Date.now()}`;

/* Channel color palette for multi-channel display */
const CHANNEL_COLORS = [
  '#2563eb', '#10b981', '#ef4444', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#e11d48',
];

/* Signal Canvas — oscilloscope-style renderer with multi-channel support */
const SignalCanvas = ({ channels, width, height, maxPoints = 500 }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const channelsRef = useRef(channels);
  const smoothRef = useRef({ min: null, max: null });

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  // Reset smoothed range when channels change
  useEffect(() => {
    const empty = !channels || channels.length === 0 || channels.every(c => c.data.length === 0);
    if (empty) smoothRef.current = { min: null, max: null };
  }, [channels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const LABEL_PAD = 52;

    const draw = () => {
      const w = width;
      const h = height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, w, h);

      const chartL = LABEL_PAD;
      const chartR = w - 8;
      const chartW = chartR - chartL;

      // Grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      for (let x = chartL + 60; x < chartR; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 40; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(chartL, y); ctx.lineTo(chartR, y); ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(chartL, h / 2); ctx.lineTo(chartR, h / 2); ctx.stroke();
      ctx.setLineDash([]);

      const chs = channelsRef.current;

      // No data state
      if (!chs || chs.length === 0 || chs.every(c => c.data.length < 2)) {
        ctx.fillStyle = '#e4e446';
        ctx.font = '500 14px Lexend, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No Signal', w / 2, h / 2);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // Gathering state
      const longestLen = Math.max(...chs.map(c => c.data.length));
      if (longestLen < maxPoints) {
        const pct = Math.round((longestLen / maxPoints) * 100);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.font = '500 13px Lexend, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Gathering Signal...', w / 2, h / 2 - 10);
        ctx.font = '400 11px Lexend, sans-serif';
        ctx.fillText(`${pct}%`, w / 2, h / 2 + 10);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // Global min/max across all visible channels
      let rawMin = Infinity, rawMax = -Infinity;
      for (const ch of chs) {
        for (let i = 0; i < ch.data.length; i++) {
          if (ch.data[i] < rawMin) rawMin = ch.data[i];
          if (ch.data[i] > rawMax) rawMax = ch.data[i];
        }
      }
      const rawRange = rawMax - rawMin || 1;
      const rawPad = rawRange * 0.15;

      // Smoothed scaling
      const s = smoothRef.current;
      if (s.min === null || s.max === null) {
        s.min = rawMin - rawPad;
        s.max = rawMax + rawPad;
      } else {
        const tMin = rawMin - rawPad;
        const tMax = rawMax + rawPad;
        s.min = tMin < s.min ? tMin : s.min + (tMin - s.min) * 0.03;
        s.max = tMax > s.max ? tMax : s.max + (tMax - s.max) * 0.03;
      }
      const lo = s.min;
      const hi = s.max;

      // Y-axis value labels (rolling average)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.font = '400 10px Lexend, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(hi.toFixed(2), LABEL_PAD - 6, 14);
      ctx.fillText(((hi + lo) / 2).toFixed(2), LABEL_PAD - 6, h / 2 + 4);
      ctx.fillText(lo.toFixed(2), LABEL_PAD - 6, h - 4);

      // Draw each channel
      for (const ch of chs) {
        const data = ch.data;
        if (data.length < 2) continue;

        ctx.strokeStyle = ch.color;
        ctx.lineWidth = chs.length > 1 ? 1.4 : 1.8;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = chartL + (i / (data.length - 1)) * chartW;
          const y = h - ((data[i] - lo) / (hi - lo)) * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Channel legend (top-right, inside chart)
      if (chs.length > 1) {
        const legendX = chartR - 8;
        let legendY = 14;
        ctx.textAlign = 'right';
        ctx.font = '500 9px Lexend, sans-serif';
        for (const ch of chs) {
          const latest = ch.data[ch.data.length - 1];
          ctx.fillStyle = ch.color;
          ctx.fillRect(legendX - ctx.measureText(`${ch.label} ${latest.toFixed(2)}`).width - 14, legendY - 6, 8, 8);
          ctx.fillText(`${ch.label}  ${latest.toFixed(2)}`, legendX, legendY);
          legendY += 14;
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [width, height, maxPoints]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
      }}
    />
  );
};

/* Color Picker Popover */
const ColorPicker = ({ color, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Signal color"
        style={{
          width: 22, height: 22, borderRadius: 5,
          border: '2px solid #e2e8f0',
          background: color, cursor: 'pointer', flexShrink: 0,
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 30, right: 0, zIndex: 50,
          background: '#ffffff', border: '1px solid #e2e8f0',
          borderRadius: 10, padding: 10, display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {SIGNAL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              style={{
                width: 26, height: 26, borderRadius: 6,
                background: c,
                border: c === color ? '2px solid #1e293b' : '2px solid transparent',
                cursor: 'pointer', transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.15)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            />
          ))}
          <div style={{ gridColumn: '1 / -1', paddingTop: 4 }}>
            <input
              type="color"
              value={color}
              onChange={(e) => { onChange(e.target.value); setOpen(false); }}
              style={{
                width: '100%', height: 28, border: 'none',
                borderRadius: 4, cursor: 'pointer', background: 'transparent',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* Resize Handle */
const ResizeHandle = ({ onResize }) => {
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    let prevX = e.clientX;
    let prevY = e.clientY;

    const onMouseMove = (e2) => {
      const dx = e2.clientX - prevX;
      const dy = e2.clientY - prevY;
      prevX = e2.clientX;
      prevY = e2.clientY;
      onResize(dx, dy);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 18, height: 18, cursor: 'nwse-resize',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.25, transition: 'opacity 0.2s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = 0.6}
      onMouseLeave={(e) => e.currentTarget.style.opacity = 0.25}
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
};

/* ── Monitor Panel ──────────────────────────────────────── */
const DISPLAY_SECONDS = 3;

const MonitorPanel = ({ id, streams, dataRef, onRemove, defaultColor }) => {
  const [selectedStream, setSelectedStream] = useState('');
  const [color, setColor] = useState(defaultColor);
  const [size, setSize] = useState({ w: Math.floor((window.innerWidth - 240) * 0.25), h: 280 });
  const [channelView, setChannelView] = useState(-1); // -1 = all channels
  const [channelData, setChannelData] = useState([]); // array of { label, color, data }
  const buffersRef = useRef([]); // per-channel sample arrays
  const cursorRef = useRef(0);

  const streamInfo = streams.find((s) => s.name === selectedStream);
  const numChannels = streamInfo ? streamInfo.channels : 0;
  const channelLabels = streamInfo?.channel_labels || [];
  const maxPoints = streamInfo ? Math.ceil(streamInfo.rate * DISPLAY_SECONDS) : 500;

  // Init per-channel buffers when stream changes
  useEffect(() => {
    buffersRef.current = Array.from({ length: numChannels }, () => []);
    cursorRef.current = 0;
    setChannelData([]);
    setChannelView(-1);
  }, [selectedStream, numChannels]);

  // Accumulate per-channel samples
  useEffect(() => {
    if (!selectedStream || numChannels === 0) return;

    const interval = setInterval(() => {
      const incoming = dataRef.current[selectedStream];
      if (!incoming || incoming.length === 0) return;

      if (cursorRef.current > incoming.length) {
        cursorRef.current = incoming.length;
      }

      const start = cursorRef.current;
      if (start >= incoming.length) return;

      for (let i = start; i < incoming.length; i++) {
        const pkt = incoming[i];
        for (let ch = 0; ch < numChannels; ch++) {
          const val = pkt.data[ch];
          if (val !== undefined && buffersRef.current[ch]) {
            buffersRef.current[ch].push(val);
          }
        }
      }
      cursorRef.current = incoming.length;

      // Trim buffers
      for (let ch = 0; ch < numChannels; ch++) {
        if (buffersRef.current[ch] && buffersRef.current[ch].length > maxPoints) {
          buffersRef.current[ch] = buffersRef.current[ch].slice(-maxPoints);
        }
      }

      // Build visible channel data
      const visible = channelView === -1
        ? Array.from({ length: numChannels }, (_, i) => i)
        : [channelView];

      setChannelData(visible.map((i) => ({
        label: channelLabels[i] || `Channel ${i + 1}`,
        color: visible.length === 1 ? color : CHANNEL_COLORS[i % CHANNEL_COLORS.length],
        data: [...(buffersRef.current[i] || [])],
      })));
    }, 33);

    return () => clearInterval(interval);
  }, [selectedStream, numChannels, channelView, dataRef, maxPoints, color, channelLabels]);

  const handleResize = useCallback((dx, dy) => {
    setSize((prev) => ({
      w: Math.max(MIN_W, prev.w + dx),
      h: Math.max(MIN_H, prev.h + dy),
    }));
  }, []);

  const canvasH = size.h - 88;

  // Current value for single-channel footer
  const singleVal = channelData.length === 1 && channelData[0].data.length > 0
    ? channelData[0].data[channelData[0].data.length - 1].toFixed(3)
    : null;

  return (
    <div
      style={{
        width: size.w, height: size.h,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        borderBottom: '1px solid #f1f5f9',
        background: '#f8fafc',
      }}>
        <select
          value={selectedStream}
          onChange={(e) => setSelectedStream(e.target.value)}
          style={{
            flex: 1, background: '#ffffff', color: '#1e293b',
            border: '1px solid #cbd5e1', borderRadius: 6,
            padding: '6px 10px', fontSize: 12,
            fontFamily: 'Lexend, sans-serif',
            fontWeight: 500,
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">Select Stream</option>
          {streams.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>

        {streamInfo && streamInfo.channels > 1 && (
          <select
            value={channelView}
            onChange={(e) => setChannelView(parseInt(e.target.value))}
            style={{
              maxWidth: 160, background: '#ffffff', color: '#1e293b',
              border: '1px solid #cbd5e1', borderRadius: 6,
              padding: '6px 8px', fontSize: 11,
              fontFamily: 'Lexend, sans-serif',
              fontWeight: 500,
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value={-1}>All Channels</option>
            {channelLabels.map((label, i) => (
              <option key={i} value={i}>{label}</option>
            ))}
          </select>
        )}

        {(channelView !== -1 || numChannels <= 1) && (
          <ColorPicker color={color} onChange={setColor} />
        )}

        <button
          onClick={() => onRemove(id)}
          title="Close monitor"
          style={{
            width: 24, height: 24, borderRadius: 5,
            background: 'transparent', border: 'none',
            color: '#94a3b8', cursor: 'pointer',
            fontSize: 15, display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
        >
          ✕
        </button>
      </div>

      {/* Signal canvas */}
      <div style={{ flex: 1, padding: '6px 6px 0 6px', minHeight: 0 }}>
        <SignalCanvas
          channels={channelData}
          width={size.w - 14}
          height={Math.max(80, canvasH)}
          maxPoints={maxPoints}
        />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px 6px',
        fontSize: 10, color: '#94a3b8',
        fontWeight: 500,
        overflow: 'hidden',
      }}>
        <span>{selectedStream || '—'}</span>
        <span style={{ textAlign: 'right' }}>
          {streamInfo ? `${streamInfo.channels}ch · ${streamInfo.rate}Hz` : ''}
          {singleVal ? ` · ${singleVal}` : ''}
        </span>
      </div>

      <ResizeHandle onResize={handleResize} />
    </div>
  );
};

/* ── Status Indicator ───────────────────────────────────── */
const StatusDot = ({ connected }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 500,
    color: connected ? '#059669' : '#dc2626',
  }}>
    <div style={{
      width: 7, height: 7, borderRadius: '50%',
      background: connected ? '#10b981' : '#ef4444',
      boxShadow: connected ? '0 0 6px rgba(16,185,129,0.4)' : '0 0 6px rgba(239,68,68,0.4)',
      animation: connected ? 'pulse 2s infinite' : 'none',
    }} />
    {connected ? 'Online' : 'Offline'}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const [monitors, setMonitors] = useState([]);
  const [streams, setStreams] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const wsRef = useRef(null);
  const dataRef = useRef({});
  const reconnectTimer = useRef(null);
  const manualDisconnect = useRef(false);

  /* ── Fetch available streams ────────────────────────── */
  const fetchStreams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/streams`);
      if (res.ok) {
        const data = await res.json();
        setStreams(data);
      }
    } catch {
      // server might not be up yet
    }
    setLoading(false);
  }, []);

  const refreshStreams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/refresh`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setStreams(data);
      }
    } catch {
      // server might not be up yet
    }
    setLoading(false);
  }, []);

  /* ── WebSocket connection ───────────────────────────── */
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
          if (dataRef.current[name].length > 600) {
            dataRef.current[name] = dataRef.current[name].slice(-300);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!manualDisconnect.current) {
          reconnectTimer.current = setTimeout(connectWs, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      reconnectTimer.current = setTimeout(connectWs, 2000);
    }
  }, [fetchStreams]);

  const disconnectWs = useCallback(() => {
    manualDisconnect.current = true;
    setRecording(false);
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (wsRef.current) wsRef.current.close();
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      manualDisconnect.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  /* ── Drain consumed data ────────────────────────────── */
  useEffect(() => {
    const interval = setInterval(() => {
      for (const key in dataRef.current) {
        if (dataRef.current[key].length > 2000) {
          dataRef.current[key] = dataRef.current[key].slice(-1000);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  /* ── Monitor CRUD ───────────────────────────────────── */
  const addMonitor = () => {
    setMonitors((prev) => [
      ...prev,
      { id: uid(), color: SIGNAL_COLORS[prev.length % SIGNAL_COLORS.length] },
    ]);
  };

  const removeMonitor = (id) => {
    setMonitors((prev) => prev.filter((m) => m.id !== id));
  };

  const handleRefresh = async () => {
    await refreshStreams();
  };

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: '#f1f5f9',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Lexend, sans-serif',
      color: '#1e293b',
      overflow: 'hidden',
    }}>
      {/* CSS keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* ── Top Bar ────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{
            fontSize: 15, fontWeight: 600, letterSpacing: '0.02em',
            color: '#1e293b', margin: 0,
          }}>
            Monitoring Dashboard
          </h1>
          <StatusDot connected={connected} />
          <button
            onClick={() => setRecording((r) => !r)}
            disabled={!connected}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 7,
              background: recording ? '#fef2f2' : '#f8fafc',
              border: recording ? '1px solid #fecaca' : '1px solid #e2e8f0',
              color: recording ? '#dc2626' : connected ? '#475569' : '#cbd5e1',
              fontSize: 12, fontWeight: 500,
              fontFamily: 'Lexend, sans-serif',
              cursor: connected ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: recording ? '#ef4444' : connected ? '#94a3b8' : '#e2e8f0',
              boxShadow: recording ? '0 0 8px rgba(239,68,68,0.5)' : 'none',
              animation: recording ? 'pulse 1.2s infinite' : 'none',
            }} />
            {recording ? 'Recording' : 'Record'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 12, color: '#94a3b8',
            fontWeight: 400, marginRight: 4,
          }}>
            {streams.length} stream{streams.length !== 1 ? 's' : ''} detected
          </span>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 7,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#475569',
              fontSize: 12, fontWeight: 500,
              fontFamily: 'Lexend, sans-serif',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
            </svg>
            {loading ? 'Scanning…' : 'Refresh'}
          </button>

          {/* Add monitor button */}
          <button
            onClick={addMonitor}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 7,
              background: '#1e293b',
              border: '1px solid #1e293b',
              color: '#ffffff',
              fontSize: 12, fontWeight: 500,
              fontFamily: 'Lexend, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#334155';
              e.currentTarget.style.borderColor = '#334155';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1e293b';
              e.currentTarget.style.borderColor = '#1e293b';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Monitor
          </button>
        </div>
      </header>

      {/* ── Monitor Grid ───────────────────────────────── */}
      <div style={{
        flex: 1, overflow: 'auto',
        padding: 20,
      }}>
        {monitors.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 14, opacity: 0.45,
          }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
              <polyline points="6 10 9 7 12 11 15 8 18 12" strokeWidth="1.5"/>
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: '#475569' }}>
                No monitors active
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Click <strong>Add Monitor</strong> to start watching a signal stream
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexWrap: 'wrap',
            gap: 14, alignContent: 'flex-start',
          }}>
            {monitors.map((m) => (
              <div key={m.id} style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <MonitorPanel
                  id={m.id}
                  streams={streams}
                  dataRef={dataRef}
                  onRemove={removeMonitor}
                  defaultColor={m.color}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom status bar ──────────────────────────── */}
      <footer style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 24px',
        borderTop: '1px solid #e2e8f0',
        background: '#ffffff',
        fontSize: 11, color: '#94a3b8',
        fontWeight: 400,
        flexShrink: 0,
      }}>
        <span>ECHO v0.2.0</span>
        <span>{monitors.length} monitor{monitors.length !== 1 ? 's' : ''}</span>
      </footer>
    </div>
  );
};

export default Dashboard;
