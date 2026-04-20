import { useState } from 'react';
import { Position } from 'reactflow';
import MLNodeBase, { LabeledHandle } from './MLNodeBase';

const SCALERS = ['none', 'standard', 'minmax', 'robust'];
const FILTERS = ['none', 'bandpass', 'lowpass', 'highpass', 'notch'];

const Row = ({ label, children }) => (
  <div className="mb-2">
    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</p>
    {children}
  </div>
);

const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 focus:outline-none focus:border-slate-500"
  >
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const NumInput = ({ value, onChange, placeholder }) => (
  <input
    type="number"
    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 focus:outline-none focus:border-slate-500"
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
  />
);

const PreprocessNode = ({ data }) => {
  const cfg = data?.config ?? {};
  const [scaler,   setScaler]   = useState(cfg.scaler   ?? 'standard');
  const [filter,   setFilter]   = useState(cfg.filter   ?? 'none');
  const [lowFreq,  setLowFreq]  = useState(cfg.lowFreq  ?? 1);
  const [highFreq, setHighFreq] = useState(cfg.highFreq ?? 50);
  const [notchHz,  setNotchHz]  = useState(cfg.notchHz  ?? 60);
  const [dropNa,   setDropNa]   = useState(cfg.dropNa   ?? true);

  const update = (patch) => {
    data?.onConfigChange?.({ scaler, filter, lowFreq, highFreq, notchHz, dropNa, ...patch });
  };

  return (
    <MLNodeBase
      label={data?.label ?? 'Preprocessor'}
      status={data?.status}
      onRemove={data?.onRemove}
      handles={<>
        <LabeledHandle type="target" position={Position.Left}  label="data in"  top="50%" />
        <LabeledHandle type="source" position={Position.Right} label="data out" top="50%" />
      </>}
    >
      <Row label="Scaler">
        <Select value={scaler} onChange={v => { setScaler(v); update({ scaler: v }); }} options={SCALERS} />
      </Row>

      <Row label="Signal Filter">
        <Select value={filter} onChange={v => { setFilter(v); update({ filter: v }); }} options={FILTERS} />
      </Row>

      {(filter === 'bandpass' || filter === 'lowpass' || filter === 'highpass') && (
        <div className="flex gap-2 mb-2">
          {(filter === 'bandpass' || filter === 'highpass') && (
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 mb-1">Low Hz</p>
              <NumInput value={lowFreq} onChange={v => { setLowFreq(v); update({ lowFreq: v }); }} placeholder="1" />
            </div>
          )}
          {(filter === 'bandpass' || filter === 'lowpass') && (
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 mb-1">High Hz</p>
              <NumInput value={highFreq} onChange={v => { setHighFreq(v); update({ highFreq: v }); }} placeholder="50" />
            </div>
          )}
        </div>
      )}

      {filter === 'notch' && (
        <Row label="Notch Hz">
          <NumInput value={notchHz} onChange={v => { setNotchHz(v); update({ notchHz: v }); }} placeholder="60" />
        </Row>
      )}

      <div className="flex items-center gap-2 mt-1">
        <input type="checkbox" id="dropna" checked={dropNa}
          onChange={e => { setDropNa(e.target.checked); update({ dropNa: e.target.checked }); }}
          className="accent-slate-400"
        />
        <label htmlFor="dropna" className="text-[11px] text-slate-400 select-none">Drop NaN rows</label>
      </div>

      {data?.result && (
        <div className="mt-3 pt-2 border-t border-slate-700">
          <p className="text-[10px] text-emerald-400 font-mono">âœ“ {data.result.rows} rows after preprocessing</p>
        </div>
      )}
    </MLNodeBase>
  );
};

export default PreprocessNode;
