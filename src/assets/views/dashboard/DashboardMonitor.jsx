import React, { useState, useEffect, useRef, useCallback } from 'react';

export const SIGNAL_COLORS = [
  '#2563eb', '#07dd96', '#ef4444', '#f5e50b',
  '#8b5cf6', '#59dff7', '#ec4899', '#8de40a',
  '#ff6a00', '#4f9bf1', '#14b8a6', '#e11d48',
];

const MIN_W = 200;
const MIN_H = 180;

let _id = 0;
const uid = () => `mon_${++_id}_${Date.now()}`;


const SignalCanvas = ({ channels, width, height, maxPoints = 500 }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const channelsRef = useRef(channels);
  const smoothRef = useRef({ min: null, max: null });

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

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

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, w, h);

      const chartL = LABEL_PAD;
      const chartR = w - 8;
      const chartW = chartR - chartL;

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      for (let x = chartL + 60; x < chartR; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 40; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(chartL, y); ctx.lineTo(chartR, y); ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(chartL, h / 2); ctx.lineTo(chartR, h / 2); ctx.stroke();
      ctx.setLineDash([]);

      const chs = channelsRef.current;

      if (!chs || chs.length === 0 || chs.every(c => c.data.length < 2)) {
        ctx.fillStyle = '#e4e446';
        ctx.font = '500 14px Lexend, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No Signal', w / 2, h / 2);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

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

      let rawMin = Infinity, rawMax = -Infinity;
      for (const ch of chs) {
        for (let i = 0; i < ch.data.length; i++) {
          if (ch.data[i] < rawMin) rawMin = ch.data[i];
          if (ch.data[i] > rawMax) rawMax = ch.data[i];
        }
      }
      const rawRange = rawMax - rawMin || 1;
      const rawPad = rawRange * 0.15;

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

      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.font = '400 10px Lexend, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(hi.toFixed(2), LABEL_PAD - 6, 14);
      ctx.fillText(((hi + lo) / 2).toFixed(2), LABEL_PAD - 6, h / 2 + 4);
      ctx.fillText(lo.toFixed(2), LABEL_PAD - 6, h - 4);

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
  const [channelView, setChannelView] = useState(-1);
  const [channelData, setChannelData] = useState([]);
  const buffersRef = useRef([]);
  const cursorRef = useRef(0);

  const streamInfo = streams.find((s) => s.name === selectedStream);
  const numChannels = streamInfo ? streamInfo.channels : 0;
  const channelLabels = streamInfo?.channel_labels || [];
  const maxPoints = streamInfo ? Math.ceil(streamInfo.rate * DISPLAY_SECONDS) : 500;

  useEffect(() => {
    buffersRef.current = Array.from({ length: numChannels }, () => []);
    cursorRef.current = 0;
    setChannelData([]);
    setChannelView(-1);
  }, [selectedStream, numChannels]);

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

      for (let ch = 0; ch < numChannels; ch++) {
        if (buffersRef.current[ch] && buffersRef.current[ch].length > maxPoints) {
          buffersRef.current[ch] = buffersRef.current[ch].slice(-maxPoints);
        }
      }

      const visible = channelView === -1
        ? Array.from({ length: numChannels }, (_, i) => i)
        : [channelView];

      setChannelData(visible.map((i) => ({
        label: channelLabels[i] || `Channel ${i + 1}`,
          color: visible.length === 1 ? color : SIGNAL_COLORS[i % SIGNAL_COLORS.length],
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

export default MonitorPanel;