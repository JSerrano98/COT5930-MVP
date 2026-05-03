import { useEffect, useMemo, useState } from 'react';

const detectPeaks = (vals, minDistance, threshold) => {
  const idxs = [];
  let last = -1e9;
  for (let i = 1; i < vals.length - 1; i++) {
    if (vals[i] > threshold && vals[i] > vals[i - 1] && vals[i] >= vals[i + 1]) {
      if (i - last >= minDistance) {
        idxs.push(i);
        last = i;
      }
    }
  }
  return idxs;
};

const RespirationNode = ({ stream, dataRef }) => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const update = () => {
      const packets = dataRef.current?.[stream.name] ?? [];
      if (!packets.length) {
        setMetrics(null);
        return;
      }

      const vals = packets.map((p) => Number(p.data?.[0] ?? 0)).filter(Number.isFinite);
      if (vals.length < 8) {
        setMetrics(null);
        return;
      }

      const rate = Math.max(1, Number(stream.rate || 1));
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const centered = vals.map((v) => v - mean);

      const minDistance = Math.max(3, Math.round(rate * 1.1));
      const peaks = detectPeaks(centered, minDistance, 0.05);

      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push((peaks[i] - peaks[i - 1]) / rate);
      }

      let rr = 0;
      let cycle = 0;
      let variabilityMs = 0;
      if (intervals.length) {
        cycle = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        rr = 60 / cycle;
        const m = cycle;
        const variance = intervals.reduce((a, b) => a + (b - m) ** 2, 0) / intervals.length;
        variabilityMs = Math.sqrt(variance) * 1000;
      }

      const latest = centered[centered.length - 1];
      const depth = Math.max(...centered) - Math.min(...centered);

      setMetrics({ rr, cycle, variabilityMs, latest, depth });
    };

    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [stream, dataRef]);

  const status = useMemo(() => {
    if (!metrics) return { text: 'Awaiting', cls: 'text-echo-dim' };
    if (metrics.rr < 10) return { text: 'Bradypnea', cls: 'text-amber-300' };
    if (metrics.rr > 22) return { text: 'Tachypnea', cls: 'text-amber-300' };
    return { text: 'Eupnea', cls: 'text-emerald-300' };
  }, [metrics]);

  if (!metrics) {
    return <div className="h-full flex items-center justify-center text-echo-dim text-xs font-mono">Awaiting respiration data…</div>;
  }

  return (
    <div className="h-full p-3 bg-echo-base text-echo-muted font-mono text-[11px] flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-echo-border p-2 bg-echo-surface-2">
          <div className="text-[9px] uppercase tracking-widest text-echo-dim">Resp Rate</div>
          <div className="text-emerald-300 text-lg leading-tight">{metrics.rr.toFixed(1)} bpm</div>
        </div>
        <div className="border border-echo-border p-2 bg-echo-surface-2">
          <div className="text-[9px] uppercase tracking-widest text-echo-dim">Cycle Time</div>
          <div className="text-cyan-300 text-lg leading-tight">{metrics.cycle.toFixed(2)} s</div>
        </div>
      </div>

      <div className="border border-echo-border p-2 bg-echo-surface-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-echo-dim">Variability</span>
        <span className="text-violet-300">{metrics.variabilityMs.toFixed(0)} ms</span>
      </div>

      <div className="border border-echo-border p-2 bg-echo-surface-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-echo-dim">Pattern</span>
        <span className={status.cls}>{status.text}</span>
      </div>

      <div className="border border-echo-border p-2 bg-echo-surface-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-echo-dim">Depth (A.U.)</span>
        <span className="text-sky-300">{metrics.depth.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default RespirationNode;
