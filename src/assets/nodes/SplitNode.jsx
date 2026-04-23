import { useState } from 'react';
import { Position } from 'reactflow';
import MLNodeBase, { LabeledHandle } from './MLNodeBase';

const STRATEGIES = ['random', 'stratified', 'time_series'];

const SplitNode = ({ data }) => {
  const cfg = data?.config ?? {};
  const [testSize,  setTestSize]  = useState(cfg.testSize  ?? 0.2);
  const [valSize,   setValSize]   = useState(cfg.valSize   ?? 0.1);
  const [strategy,  setStrategy]  = useState(cfg.strategy  ?? 'stratified');
  const [shuffle,   setShuffle]   = useState(cfg.shuffle   ?? true);
  const [seed,      setSeed]      = useState(cfg.seed      ?? 42);

  const update = (patch) => {
    data?.onConfigChange?.({ testSize, valSize, strategy, shuffle, seed, ...patch });
  };

  const trainPct = Math.round((1 - testSize - valSize) * 100);
  const valPct   = Math.round(valSize  * 100);
  const testPct  = Math.round(testSize * 100);

  return (
    <MLNodeBase
      label={data?.label ?? 'Train / Test Split'}
      status={data?.status}
      onRemove={data?.onRemove}
      handles={<>
        <LabeledHandle type="target" position={Position.Left}  label="features in" top="50%" />
        <LabeledHandle type="source" position={Position.Right} label="splits out"  top="50%" />
      </>}
    >
      {/* Visual ratio bar */}
      <div className="flex h-4 mb-3 overflow-hidden border border-slate-700">
        <div className="bg-slate-600 flex items-center justify-center text-[9px] text-slate-200 font-bold" style={{ width: `${trainPct}%` }}>
          {trainPct}%
        </div>
        {valPct > 0 && (
          <div className="bg-slate-500 flex items-center justify-center text-[9px] text-slate-200 font-bold" style={{ width: `${valPct}%` }}>
            {valPct}%
          </div>
        )}
        <div className="bg-slate-400 flex items-center justify-center text-[9px] text-slate-900 font-bold" style={{ width: `${testPct}%` }}>
          {testPct}%
        </div>
      </div>
      <div className="flex gap-3 text-[10px] text-slate-500 mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-600 inline-block" /> Train</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-500 inline-block" /> Val</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-400 inline-block" /> Test</span>
      </div>

      <div className="mb-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Test Size ({testPct}%)</p>
        <input type="range" min="0.05" max="0.5" step="0.05" value={testSize}
          onChange={e => { setTestSize(parseFloat(e.target.value)); update({ testSize: parseFloat(e.target.value) }); }}
          className="w-full accent-slate-400"
        />
      </div>

      <div className="mb-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Val Size ({valPct}%)</p>
        <input type="range" min="0" max="0.3" step="0.05" value={valSize}
          onChange={e => { setValSize(parseFloat(e.target.value)); update({ valSize: parseFloat(e.target.value) }); }}
          className="w-full accent-slate-400"
        />
      </div>

      <div className="mb-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Strategy</p>
        <div className="flex gap-1">
          {STRATEGIES.map(s => (
            <button key={s} onClick={() => { setStrategy(s); update({ strategy: s }); }}
              className={`flex-1 px-1 py-1 text-[9px] font-semibold border transition-colors ${
                strategy === s ? 'bg-slate-600 border-slate-500 text-slate-100' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-400 select-none">
          <input type="checkbox" checked={shuffle} onChange={e => { setShuffle(e.target.checked); update({ shuffle: e.target.checked }); }} className="accent-slate-400" />
          Shuffle
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">Seed</span>
          <input type="number" className="w-16 bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-0.5 focus:outline-none focus:border-slate-500"
            value={seed} onChange={e => { setSeed(e.target.value); update({ seed: e.target.value }); }} />
        </div>
      </div>
    </MLNodeBase>
  );
};

export default SplitNode;
