import { useEffect, useRef, useState } from 'react';

const HISTORY_S = 30;  // seconds of BPM history to keep

// BPM zone thresholds (standard adult resting/active ranges)
const ZONES = [
  { max: 60,  label: 'Low',      color: '#60a5fa' },  // blue
  { max: 100, label: 'Normal',   color: '#22c55e' },  // green
  { max: 140, label: 'Elevated', color: '#eab308' },  // yellow
  { max: Infinity, label: 'High', color: '#ef4444' }, // red
];

const zoneFor = (bpm) => ZONES.find(z => bpm <= z.max) ?? ZONES[ZONES.length - 1];

const BPMNode = ({ stream, dataRef }) => {
  const [bpm,     setBpm]     = useState(null);
  const [zone,    setZone]    = useState(ZONES[1]);
  const [history, setHistory] = useState([]);   // [{ bpm, ts }]
  const timerRef = useRef(null);

  useEffect(() => {
    if (!stream) return;

    const update = () => {
      const packets = dataRef.current?.[stream.name] ?? [];
      if (!packets.length) return;

      const last = packets[packets.length - 1];
      const val  = last?.data?.[0] ?? null;
      if (val == null) return;

      const now = last.timestamp ?? Date.now() / 1000;
      setBpm(Math.round(val));
      setZone(zoneFor(val));

      setHistory(prev => {
        const next = [...prev, { bpm: val, ts: now }].filter(
          p => p.ts >= now - HISTORY_S
        );
        return next;
      });
    };

    update();
    timerRef.current = setInterval(update, 200);
    return () => clearInterval(timerRef.current);
  }, [stream, dataRef]);

  // Derived stats from history
  const bpms = history.map(h => h.bpm);
  const min  = bpms.length ? Math.round(Math.min(...bpms)) : null;
  const max  = bpms.length ? Math.round(Math.max(...bpms)) : null;
  const avg  = bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null;

  const color = zone.color;

  return (
    <div className="flex flex-col h-full bg-slate-950 select-none">

      {/* Main BPM readout */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1 px-4">
        {bpm == null ? (
          <span className="text-[11px] font-mono text-slate-500">Awaiting data...</span>
        ) : (
          <>
            {/* Large BPM number */}
            <div
              className="font-mono font-bold leading-none tabular-nums transition-colors duration-500"
              style={{ fontSize: 'clamp(3rem, 10vw, 6rem)', color }}
            >
              {bpm}
            </div>

            {/* Unit label */}
            <span className="text-[11px] font-mono text-slate-500 tracking-widest uppercase">
              BPM
            </span>

            {/* Zone badge */}
            <span
              className="mt-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm"
              style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}44` }}
            >
              {zone.label}
            </span>
          </>
        )}
      </div>

      {/* Stats bar */}
      {bpm != null && (
        <div className="flex items-center justify-around px-4 py-2 border-t border-slate-800 text-[10px] font-mono">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-slate-500 uppercase tracking-widest text-[8px]">Min</span>
            <span className="text-slate-300">{min ?? '–'}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-slate-500 uppercase tracking-widest text-[8px]">Avg</span>
            <span className="text-slate-300">{avg ?? '–'}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-slate-500 uppercase tracking-widest text-[8px]">Max</span>
            <span className="text-slate-300">{max ?? '–'}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-slate-500 uppercase tracking-widest text-[8px]">Window</span>
            <span className="text-slate-300">{HISTORY_S}s</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BPMNode;
