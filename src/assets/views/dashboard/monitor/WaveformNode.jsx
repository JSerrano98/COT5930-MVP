import { useEffect, useRef, useState, useCallback } from 'react';

const WINDOW_S     = 5;
const SCALE_FRAMES = 45;

const WaveformNode = ({ stream, dataRef, lineColor }) => {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);

  const nCh = stream?.channels ?? 0;
  const labels = stream?.channel_labels ?? [];

  // Set of enabled channel indices — mutated directly so draw loop reads latest without re-renders
  const enabledRef = useRef(new Set(Array.from({ length: nCh }, (_, i) => i)));

  // Re-initialise enabledRef when stream/nCh changes
  useEffect(() => {
    enabledRef.current = new Set(Array.from({ length: nCh }, (_, i) => i));
  }, [nCh]);

  // Dropdown state
  const [open,    setOpen]    = useState(false);
  const [enabled, setEnabled] = useState(() => new Set(Array.from({ length: nCh }, (_, i) => i)));

  const toggleCh = useCallback((ch) => {
    setEnabled(prev => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      enabledRef.current = next;   // sync to draw loop
      return next;
    });
  }, []);

  const enableAll  = () => { const s = new Set(Array.from({ length: nCh }, (_, i) => i)); enabledRef.current = s; setEnabled(s); };
  const disableAll = () => { enabledRef.current = new Set(); setEnabled(new Set()); };

  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!canvas || !container || !stream) return;

    const ctx           = canvas.getContext('2d');
    const windowSamples = Math.ceil(WINDOW_S * stream.rate) || 256;

    const ring    = new Float32Array(nCh * windowSamples);
    let writeHead = 0;
    let readIdx   = 0;

    const scaleMin = new Float32Array(nCh).fill(-1);
    const scaleMax = new Float32Array(nCh).fill(1);
    let frameCount = 0;

    const recomputeScale = () => {
      const filled = Math.min(writeHead, windowSamples);
      if (filled < 2) return;
      for (let ch = 0; ch < nCh; ch++) {
        let lo = Infinity, hi = -Infinity;
        const base = ch * windowSamples;
        for (let i = 0; i < filled; i++) {
          const v = ring[base + i];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const range = hi - lo;
        const pad   = range * 0.1 || 1e-6;
        scaleMin[ch] = scaleMin[ch] * 0.8 + (lo - pad) * 0.2;
        scaleMax[ch] = scaleMax[ch] * 0.8 + (hi + pad) * 0.2;
      }
    };

    const syncSize = () => {
      canvas.width  = container.clientWidth  || 1;
      canvas.height = container.clientHeight || 1;
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);

    const draw = () => {
      const packets = dataRef.current[stream.name] ?? [];
      if (readIdx > packets.length) readIdx = packets.length;
      while (readIdx < packets.length) {
        const pkt = packets[readIdx++];
        const pos = writeHead % windowSamples;
        for (let ch = 0; ch < nCh; ch++) {
          ring[ch * windowSamples + pos] = pkt.data?.[ch] ?? 0;
        }
        writeHead++;
      }

      frameCount++;
      if (frameCount % SCALE_FRAMES === 0 || frameCount === 1) recomputeScale();

      const W = canvas.width;
      const H = canvas.height;

      ctx.fillStyle = '#070d18';
      ctx.fillRect(0, 0, W, H);

      const filled = Math.min(writeHead, windowSamples);

      if (filled < 2) {
        ctx.fillStyle    = '#1e293b';
        ctx.font         = '11px monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign    = 'center';
        ctx.fillText('Awaiting data…', W / 2, H / 2);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const activeSet  = enabledRef.current;
      const activeChs  = Array.from({ length: nCh }, (_, i) => i).filter(ch => activeSet.has(ch));
      const nActive    = activeChs.length || 1;
      const trackH     = H / nActive;
      const oldest     = writeHead % windowSamples;
      const traceColor = lineColor || '#07dd96';

      activeChs.forEach((ch, slot) => {
        const base  = ch * windowSamples;
        const lo    = scaleMin[ch];
        const range = (scaleMax[ch] - lo) || 1e-9;
        const midY  = (slot + 0.5) * trackH;
        const amp   = trackH * 0.44;

        if (slot > 0) {
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.moveTo(0, Math.round(slot * trackH) + 0.5);
          ctx.lineTo(W, Math.round(slot * trackH) + 0.5);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.strokeStyle = traceColor;
        ctx.lineWidth   = 1;
        ctx.globalAlpha = nActive > 16 ? 0.75 : 1;

        for (let i = 0; i < filled; i++) {
          const pos  = (oldest + i) % windowSamples;
          const x    = (i / (windowSamples - 1)) * W;
          const norm = (ring[base + pos] - lo) / range;
          const y    = midY - (norm - 0.5) * 2 * amp;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle    = '#334155';
        ctx.font         = '9px monospace';
        ctx.textBaseline = 'top';
        ctx.textAlign    = 'left';
        ctx.fillText(labels[ch] ?? `CH${ch + 1}`, 4, slot * trackH + 2);
      });

      const cursorX = ((writeHead % windowSamples) / (windowSamples - 1)) * W;
      ctx.strokeStyle = '#1e3a5f';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, H);
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [stream, dataRef, lineColor, nCh, labels]);

  return (
    <div className="relative w-full h-full flex flex-col">

      {/* Channel selector button */}
      <div className="absolute top-1 right-1 z-10">
        <button
          onClick={() => setOpen(o => !o)}
          onMouseDown={e => e.stopPropagation()}
          className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors leading-none"
          title="Show/hide channels"
        >
          CH {enabled.size}/{nCh}
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-0.5 bg-slate-900 border border-slate-700 shadow-xl z-20 min-w-[130px] max-h-64 overflow-y-auto"
            onMouseDown={e => e.stopPropagation()}
          >
            {/* All / None */}
            <div className="flex gap-1 px-2 py-1 border-b border-slate-800">
              <button onClick={enableAll}  className="text-[9px] font-mono text-slate-400 hover:text-slate-200">All</button>
              <span className="text-slate-700 text-[9px]">|</span>
              <button onClick={disableAll} className="text-[9px] font-mono text-slate-400 hover:text-slate-200">None</button>
            </div>

            {Array.from({ length: nCh }, (_, ch) => (
              <label
                key={ch}
                className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-slate-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={enabled.has(ch)}
                  onChange={() => toggleCh(ch)}
                  className="accent-emerald-400 w-3 h-3"
                />
                <span className="text-[10px] font-mono text-slate-300">
                  {labels[ch] ?? `CH${ch + 1}`}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Canvas fills remaining space */}
      <div ref={containerRef} className="w-full h-full">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
};

export default WaveformNode;
