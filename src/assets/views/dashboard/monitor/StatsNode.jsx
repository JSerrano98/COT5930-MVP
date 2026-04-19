import { useEffect, useRef, useState } from 'react';

const MAX_CH      = 32;
const MAX_SAMPLES = 10_000;

const fmt = (v) => (isFinite(v) ? v.toFixed(3) : '—');

const computeStats = (packets, nCh, nSamples) => {
  const slice = packets.slice(-nSamples);
  if (!slice.length) return null;

  return Array.from({ length: nCh }, (_, ch) => {
    const vals = slice.map(p => p.data?.[ch] ?? 0);
    const n    = vals.length;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const std  = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const rms  = Math.sqrt(vals.reduce((a, b) => a + b * b, 0) / n);
    return {
      ch,
      latest: vals[n - 1],
      mean, std, rms,
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  });
};

const StatsNode = ({ stream, dataRef }) => {
  const rate = stream?.rate ?? 1;
  const nCh  = Math.min(stream?.channels ?? 1, MAX_CH);

  // Time window controls — default 1 second
  const [windowVal,  setWindowVal]  = useState(1);
  const [windowUnit, setWindowUnit] = useState('s');  // 'ms' | 's' | 'min' | 'samples'

  const calcSamples = () => Math.min(
    Math.max(1,
      windowUnit === 'samples' ? Math.round(windowVal) :
      windowUnit === 'ms'      ? Math.round(windowVal / 1000 * rate) :
      windowUnit === 'min'     ? Math.round(windowVal * 60 * rate) :
      /* 's' */                  Math.round(windowVal * rate)
    ),
    MAX_SAMPLES
  );

  const [rows, setRows] = useState(null);
  const [nSamples, setNSamples] = useState(calcSamples);
  const timerRef = useRef(null);

  useEffect(() => {
    const n = calcSamples();
    setNSamples(n);
    const update = () => {
      const packets = dataRef.current?.[stream.name] ?? [];
      setRows(computeStats(packets, nCh, n));
    };
    update();
    timerRef.current = setInterval(update, 250);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, dataRef, nCh, windowVal, windowUnit, rate]);

  return (
    <div className="flex flex-col h-full">

      {/* Time-window control bar */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-slate-800 bg-slate-950 flex-shrink-0">
        <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">Window</span>
        <input
          type="number"
          min={1}
          step={windowUnit === 'ms' ? 10 : windowUnit === 'min' ? 0.1 : windowUnit === 's' ? 0.1 : 1}
          value={windowVal}
          onChange={e => setWindowVal(Math.max(0.001, parseFloat(e.target.value) || 1))}
          className="w-16 bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-mono px-1.5 py-0.5 focus:outline-none focus:border-slate-500"
        />
        <select
          value={windowUnit}
          onChange={e => setWindowUnit(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-mono px-1 py-0.5 focus:outline-none focus:border-slate-500"
        >
          <option value="ms">ms</option>
          <option value="s">s</option>
          <option value="min">min</option>
          <option value="samples">samples</option>
        </select>
        <span className="text-[9px] text-slate-600 font-mono ml-auto">
          {nSamples.toLocaleString()} samp
        </span>
      </div>

      {/* Stats table */}
      {!rows ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-mono">
          Awaiting data…
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-[10px] font-mono">
            <thead className="sticky top-0 bg-slate-900 z-10">
              <tr className="border-b border-slate-700 text-slate-500">
                <th className="text-left  px-2 py-1 font-normal">CH</th>
                <th className="text-right px-2 py-1 font-normal">LAST</th>
                <th className="text-right px-2 py-1 font-normal">MEAN</th>
                <th className="text-right px-2 py-1 font-normal">STD</th>
                <th className="text-right px-2 py-1 font-normal">RMS</th>
                <th className="text-right px-2 py-1 font-normal">MIN</th>
                <th className="text-right px-2 py-1 font-normal">MAX</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.ch} className="border-b border-slate-800 text-slate-300">
                  <td className="px-2 py-0.5 text-slate-500">
                    {stream.channel_labels?.[r.ch] ?? `CH${r.ch + 1}`}
                  </td>
                  <td className="px-2 py-0.5 text-right text-emerald-400">{fmt(r.latest)}</td>
                  <td className="px-2 py-0.5 text-right">{fmt(r.mean)}</td>
                  <td className="px-2 py-0.5 text-right">{fmt(r.std)}</td>
                  <td className="px-2 py-0.5 text-right">{fmt(r.rms)}</td>
                  <td className="px-2 py-0.5 text-right">{fmt(r.min)}</td>
                  <td className="px-2 py-0.5 text-right">{fmt(r.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StatsNode;
