import { useState } from 'react';
import { Position } from 'reactflow';
import MLNodeBase, { LabeledHandle } from './MLNodeBase';

const FEATURE_GROUPS = [
  {
    group: 'Time Domain',
    features: ['mean', 'std', 'variance', 'skewness', 'kurtosis', 'rms', 'peak_to_peak', 'zero_crossings'],
  },
  {
    group: 'Frequency Domain',
    features: ['fft_power', 'dominant_freq', 'spectral_entropy', 'band_power_delta', 'band_power_theta', 'band_power_alpha', 'band_power_beta', 'band_power_gamma'],
  },
  {
    group: 'Nonlinear',
    features: ['sample_entropy', 'approximate_entropy', 'hjorth_mobility', 'hjorth_complexity'],
  },
];

const FeatureNode = ({ data }) => {
  const cfg = data?.config ?? {};
  const [selected, setSelected] = useState(new Set(cfg.features ?? ['mean', 'std', 'band_power_alpha']));
  const [windowSize, setWindowSize] = useState(cfg.windowSize ?? 256);
  const [overlap,    setOverlap]    = useState(cfg.overlap    ?? 0.5);

  const toggle = (feat) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(feat) ? next.delete(feat) : next.add(feat);
      data?.onConfigChange?.({ features: [...next], windowSize, overlap });
      return next;
    });
  };

  return (
    <MLNodeBase
      label={data?.label ?? 'Feature Engineering'}
      status={data?.status}
      onRemove={data?.onRemove}
      minHeight={200}
      handles={<>
        <LabeledHandle type="target" position={Position.Left}  label="data in"      top="50%" />
        <LabeledHandle type="source" position={Position.Right} label="features out" top="50%" />
      </>}
    >
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Window</p>
          <input type="number"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 focus:outline-none focus:border-slate-500"
            value={windowSize}
            onChange={e => { setWindowSize(e.target.value); data?.onConfigChange?.({ features: [...selected], windowSize: e.target.value, overlap }); }}
          />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Overlap</p>
          <input type="number" min="0" max="0.99" step="0.05"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 focus:outline-none focus:border-slate-500"
            value={overlap}
            onChange={e => { setOverlap(e.target.value); data?.onConfigChange?.({ features: [...selected], windowSize, overlap: e.target.value }); }}
          />
        </div>
      </div>

      {FEATURE_GROUPS.map(({ group, features }) => (
        <div key={group} className="mb-3">
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">{group}</p>
          <div className="flex flex-wrap gap-1">
            {features.map(f => (
              <button key={f} onClick={() => toggle(f)}
                className={`px-1.5 py-0.5 text-[10px] border transition-colors ${
                  selected.has(f)
                    ? 'bg-slate-600 border-slate-500 text-slate-100'
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      ))}

      {data?.result && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <p className="text-[10px] text-emerald-400 font-mono">âœ“ {data.result.feature_count} features extracted</p>
        </div>
      )}
    </MLNodeBase>
  );
};

export default FeatureNode;
