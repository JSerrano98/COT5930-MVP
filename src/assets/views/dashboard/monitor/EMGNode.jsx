import { useEffect, useMemo, useState } from 'react';

const percentile = (arr, q) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[idx];
};

const EMGNode = ({ stream, dataRef }) => {
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

      const rate = Math.max(1, Math.round(stream.rate || 1));
      const activeWindow = vals.slice(-Math.min(vals.length, Math.round(rate * 0.3)));
      const baselineWindow = vals.slice(-Math.min(vals.length, Math.round(rate * 30)));

      const absShort = activeWindow.map((v) => Math.abs(v));
      const absLong = baselineWindow.map((v) => Math.abs(v));
      const rms = Math.sqrt(absShort.reduce((a, b) => a + b * b, 0) / Math.max(1, absShort.length));
      const mav = absShort.reduce((a, b) => a + b, 0) / Math.max(1, absShort.length);

      const floor = percentile(absLong, 0.1);
      const high = Math.max(floor + 1, percentile(absLong, 0.95));
      const activationPct = ((rms - floor) / (high - floor)) * 100;

      let bursts = 0;
      let inBurst = false;
      const onThr = floor + (high - floor) * 0.35;
      const offThr = floor + (high - floor) * 0.22;
      for (const v of absLong) {
        if (!inBurst && v >= onThr) {
          inBurst = true;
          bursts += 1;
        } else if (inBurst && v <= offThr) {
          inBurst = false;
        }
      }
      const durationMin = Math.max(1 / 60, absLong.length / rate / 60);

      setMetrics({
        rms,
        mav,
        activationPct: Math.max(0, Math.min(100, activationPct)),
        burstsPerMin: bursts / durationMin,
      });
    };

    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [stream, dataRef]);

  const toneClass = useMemo(() => {
    if (!metrics) return 'text-echo-dim';
    if (metrics.activationPct < 30) return 'text-sky-300';
    if (metrics.activationPct < 70) return 'text-emerald-300';
    return 'text-amber-300';
  }, [metrics]);

  if (!metrics) {
    return <div className="h-full flex items-center justify-center text-echo-dim text-xs font-mono">Awaiting EMG data…</div>;
  }

  return (
    <div className="h-full p-3 bg-echo-base text-echo-muted font-mono text-[11px] flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-echo-border p-2 bg-echo-surface-2">
          <div className="text-[9px] uppercase tracking-widest text-echo-dim">RMS</div>
          <div className="text-emerald-300 text-lg leading-tight">{metrics.rms.toFixed(1)} uV</div>
        </div>
        <div className="border border-echo-border p-2 bg-echo-surface-2">
          <div className="text-[9px] uppercase tracking-widest text-echo-dim">MAV</div>
          <div className="text-cyan-300 text-lg leading-tight">{metrics.mav.toFixed(1)} uV</div>
        </div>
      </div>

      <div className="border border-echo-border p-2 bg-echo-surface-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-echo-dim mb-1">
          <span>Muscle Activation</span>
          <span className={toneClass}>{metrics.activationPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-echo-base border border-echo-border overflow-hidden">
          <div className="h-full bg-gradient-to-r from-sky-500 via-emerald-400 to-amber-400" style={{ width: `${metrics.activationPct}%` }} />
        </div>
      </div>

      <div className="border border-echo-border p-2 bg-echo-surface-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-echo-dim">Burst Cadence</span>
        <span className="text-violet-300">{metrics.burstsPerMin.toFixed(1)} /min</span>
      </div>
    </div>
  );
};

export default EMGNode;
