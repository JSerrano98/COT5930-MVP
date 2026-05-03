import { useEffect, useMemo, useState } from 'react';

const regressionSlopePerMin = (vals, rate) => {
  if (vals.length < 3 || rate <= 0) return 0;
  const n = vals.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i / rate / 60;
    const y = vals[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return 0;
  return (n * sumXY - sumX * sumY) / denom;
};

const TemperatureNode = ({ stream, dataRef }) => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const update = () => {
      const packets = dataRef.current?.[stream.name] ?? [];
      if (!packets.length) {
        setMetrics(null);
        return;
      }

      const vals = packets.map((p) => Number(p.data?.[0] ?? 0)).filter(Number.isFinite);
      if (!vals.length) {
        setMetrics(null);
        return;
      }

      const rate = Math.max(1, Number(stream.rate || 1));
      const latest = vals[vals.length - 1];
      const trendWindow = vals.slice(-Math.min(vals.length, Math.round(rate * 300)));
      const slope = regressionSlopePerMin(trendWindow, rate);

      setMetrics({ latest, slope });
    };

    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [stream, dataRef]);

  const status = useMemo(() => {
    if (!metrics) return { text: 'Awaiting', cls: 'text-echo-dim' };
    if (metrics.latest < 35.0) return { text: 'Hypothermia', cls: 'text-sky-300' };
    if (metrics.latest >= 37.8) return { text: 'Febrile', cls: 'text-amber-300' };
    return { text: 'Normothermia', cls: 'text-emerald-300' };
  }, [metrics]);

  if (!metrics) {
    return <div className="h-full flex items-center justify-center text-echo-dim text-xs font-mono">Awaiting temperature data…</div>;
  }

  const arrow = metrics.slope > 0.01 ? '↑' : metrics.slope < -0.01 ? '↓' : '→';

  return (
    <div className="h-full p-3 bg-echo-base text-echo-muted font-mono text-[11px] flex flex-col gap-2">
      <div className="border border-echo-border p-3 bg-echo-surface-2">
        <div className="text-[9px] uppercase tracking-widest text-echo-dim">Temperature</div>
        <div className="text-emerald-300 text-3xl leading-tight">{metrics.latest.toFixed(2)} C</div>
      </div>

      <div className="border border-echo-border p-2 bg-echo-surface-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-echo-dim">5-min Trend</span>
        <span className="text-cyan-300">{arrow} {metrics.slope.toFixed(3)} C/min</span>
      </div>

      <div className="border border-echo-border p-2 bg-echo-surface-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-echo-dim">Clinical Flag</span>
        <span className={status.cls}>{status.text}</span>
      </div>
    </div>
  );
};

export default TemperatureNode;
