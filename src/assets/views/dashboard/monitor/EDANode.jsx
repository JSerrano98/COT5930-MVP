import { useEffect, useMemo, useState } from 'react';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const EDANode = ({ stream, dataRef }) => {
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

      const latest = vals[vals.length - 1];
      const tonicWindow = vals.slice(-Math.max(30, Math.round((stream.rate || 1) * 15)));
      const tonic = tonicWindow.reduce((a, b) => a + b, 0) / tonicWindow.length;
      const phasic = latest - tonic;

      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const thr = mean + 0.08;
      let peaks = 0;
      let lastPeakIdx = -1e9;
      const minDist = Math.max(4, Math.round((stream.rate || 1) * 1.0));
      for (let i = 1; i < vals.length - 1; i++) {
        if (vals[i] > vals[i - 1] && vals[i] >= vals[i + 1] && vals[i] > thr) {
          if (i - lastPeakIdx >= minDist) {
            peaks += 1;
            lastPeakIdx = i;
          }
        }
      }

      const durationMin = Math.max(1 / 60, vals.length / Math.max(1, stream.rate || 1) / 60);
      const scrPerMin = peaks / durationMin;

      setMetrics({ latest, tonic, phasic, scrPerMin });
    };

    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [stream, dataRef]);

  const arousal = useMemo(() => {
    if (!metrics) return 0;
    const score = clamp(metrics.scrPerMin / 8, 0, 1) * 0.6 + clamp(metrics.phasic / 0.5, 0, 1) * 0.4;
    return Math.round(score * 100);
  }, [metrics]);

  if (!metrics) {
    return <div className="h-full flex items-center justify-center text-echo-dim text-xs font-mono">Awaiting EDA data…</div>;
  }

  return (
    <div className="h-full p-3 bg-echo-base text-echo-muted font-mono text-[11px] flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-echo-border p-2 bg-echo-surface-2">
          <div className="text-[9px] uppercase tracking-widest text-echo-dim">SCL</div>
          <div className="text-emerald-300 text-lg leading-tight">{metrics.latest.toFixed(2)} uS</div>
        </div>
        <div className="border border-echo-border p-2 bg-echo-surface-2">
          <div className="text-[9px] uppercase tracking-widest text-echo-dim">SCR Rate</div>
          <div className="text-cyan-300 text-lg leading-tight">{metrics.scrPerMin.toFixed(1)} /min</div>
        </div>
      </div>

      <div className="border border-echo-border p-2 bg-echo-surface-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-echo-dim">Phasic Shift</span>
        <span className={metrics.phasic >= 0 ? 'text-amber-300' : 'text-sky-300'}>
          {metrics.phasic >= 0 ? '+' : ''}{metrics.phasic.toFixed(3)} uS
        </span>
      </div>

      <div className="border border-echo-border p-2 bg-echo-surface-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-echo-dim mb-1">
          <span>Arousal Index</span>
          <span>{arousal}%</span>
        </div>
        <div className="h-2 bg-echo-base border border-echo-border overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400" style={{ width: `${arousal}%` }} />
        </div>
      </div>
    </div>
  );
};

export default EDANode;
