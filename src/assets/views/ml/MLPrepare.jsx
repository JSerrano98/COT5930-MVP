import { useEffect, useState } from 'react';

const BACKEND = 'http://localhost:8000';

export const DEFAULT_PREPARE = {
  scaler: 'none',
  featureSelection: 'none',
  kBestK: 10,
  varianceThreshold: 0.0,
  correlationThreshold: 0.95,
  selectedCols: [],
  polyDegree: 1,
  logTransformCols: [],
  sqrtTransformCols: [],
};

const SCALER_OPTIONS = [
  { value: 'none',     label: 'None',     desc: 'No scaling applied' },
  { value: 'standard', label: 'Standard', desc: 'Zero mean, unit variance (Z-score)' },
  { value: 'minmax',   label: 'Min-Max',  desc: 'Scales features to [0, 1]' },
  { value: 'robust',   label: 'Robust',   desc: 'Median/IQR — resistant to outliers' },
  { value: 'maxabs',   label: 'Max Abs',  desc: 'Scale by max absolute value' },
];

const FEAT_SEL_OPTIONS = [
  { value: 'none',        label: 'None',        desc: 'Keep all features' },
  { value: 'manual',      label: 'Manual',      desc: 'Hand-pick which columns to use' },
  { value: 'variance',    label: 'Variance',    desc: 'Drop near-zero-variance features' },
  { value: 'kbest',       label: 'K Best',      desc: 'Keep top-K by statistical score' },
  { value: 'correlation', label: 'Correlation', desc: 'Drop one of each highly-correlated pair' },
];

const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-4">
    <h2 className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">{title}</h2>
    {subtitle && <p className="mt-0.5 text-xs text-echo-dim font-body">{subtitle}</p>}
  </div>
);

const CardButton = ({ active, onClick, label, desc }) => (
  <button
    onClick={onClick}
    className={`border p-3 text-left transition-colors ${
      active
        ? 'border-echo-green bg-echo-green/10 text-echo-green'
        : 'border-echo-border bg-echo-surface-2 text-echo-muted hover:border-echo-muted hover:text-white'
    }`}
  >
    <p className="text-[10px] font-ui font-semibold uppercase tracking-widest">{label}</p>
    <p className="mt-1 text-[10px] font-body leading-tight opacity-70">{desc}</p>
  </button>
);

const MLPrepare = ({ intake, prepare, onPrepareChange, onBack, onContinue }) => {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!intake.datasetPath) return;
    setLoading(true);
    setError('');
    fetch(`${BACKEND}/ml/workbench/columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_path: intake.datasetPath }),
    })
      .then((r) => r.json())
      .then((data) => setColumns(data.columns ?? []))
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [intake.datasetPath]);

  const set = (patch) => onPrepareChange({ ...prepare, ...patch });

  const toggleCol = (col, key) => {
    const arr = prepare[key] ?? [];
    set({ [key]: arr.includes(col) ? arr.filter((c) => c !== col) : [...arr, col] });
  };

  const allManualSelected = columns.length > 0 && prepare.selectedCols.length === columns.length;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-echo-bg">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-echo-border bg-echo-surface px-6 py-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="border border-echo-border bg-echo-surface-2 px-3 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase text-echo-muted hover:border-echo-muted hover:text-white transition-colors"
        >
          Back
        </button>
        <div>
          <h1 className="font-title text-lg tracking-[0.12em] text-white">PREPARE</h1>
          <p className="text-[10px] text-echo-muted font-body">Scale, engineer, and select features before training.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onPrepareChange({ ...DEFAULT_PREPARE })}
            className="border border-echo-border px-3 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase text-echo-muted hover:border-echo-muted hover:text-white transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onContinue}
            className="border border-echo-green px-4 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase text-echo-green bg-echo-green/10 hover:bg-echo-green/20 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {error && (
          <div className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-body">{error}</div>
        )}

        {/* ── Scaling ── */}
        <div className="border border-echo-border bg-echo-surface p-5">
          <SectionHeader
            title="Feature Scaling"
            subtitle="Rescale numeric features before they reach the model."
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {SCALER_OPTIONS.map(({ value, label, desc }) => (
              <CardButton
                key={value}
                active={prepare.scaler === value}
                onClick={() => set({ scaler: value })}
                label={label}
                desc={desc}
              />
            ))}
          </div>
        </div>

        {/* ── Feature Engineering ── */}
        <div className="border border-echo-border bg-echo-surface p-5">
          <SectionHeader
            title="Feature Engineering"
            subtitle="Create new features or transform existing ones."
          />

          {/* Polynomial degree */}
          <div className="mb-5">
            <label className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">
              Polynomial Expansion
            </label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  onClick={() => set({ polyDegree: d })}
                  className={`border px-4 py-2 text-[10px] font-ui font-semibold uppercase tracking-widest transition-colors ${
                    prepare.polyDegree === d
                      ? 'border-echo-green bg-echo-green/10 text-echo-green'
                      : 'border-echo-border bg-echo-surface-2 text-echo-muted hover:border-echo-muted hover:text-white'
                  }`}
                >
                  {d === 1 ? 'None' : `Degree ${d}`}
                </button>
              ))}
            </div>
            {prepare.polyDegree > 1 && (
              <p className="mt-1.5 text-[10px] text-amber-400 font-body">
                Higher degree can greatly increase dimensionality.
              </p>
            )}
          </div>

          {/* Per-column log / sqrt */}
          <label className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">
            Per-Column Transforms
          </label>
          {loading ? (
            <p className="mt-2 text-xs text-echo-dim font-body">Loading columns…</p>
          ) : columns.length > 0 ? (
            <div className="mt-2 overflow-hidden border border-echo-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-echo-border bg-echo-surface-2 text-left">
                    <th className="px-4 py-2 text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Column</th>
                    <th className="px-4 py-2 text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted text-center">Log₁₊ᵪ</th>
                    <th className="px-4 py-2 text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted text-center">√x</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, i) => (
                    <tr
                      key={col}
                      className={`border-b border-echo-border last:border-none ${i % 2 === 1 ? 'bg-echo-surface-2/40' : ''}`}
                    >
                      <td className="max-w-[220px] truncate px-4 py-2 font-ui font-medium text-white text-sm" title={col}>{col}</td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={prepare.logTransformCols.includes(col)}
                          onChange={() => toggleCol(col, 'logTransformCols')}
                          className="accent-echo-green"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={prepare.sqrtTransformCols.includes(col)}
                          onChange={() => toggleCol(col, 'sqrtTransformCols')}
                          className="accent-echo-green"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-xs text-echo-dim font-body">No columns available.</p>
          )}
        </div>

        {/* ── Feature Selection ── */}
        <div className="border border-echo-border bg-echo-surface p-5">
          <SectionHeader
            title="Feature Selection"
            subtitle="Reduce the feature set entering the model."
          />
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {FEAT_SEL_OPTIONS.map(({ value, label, desc }) => (
              <CardButton
                key={value}
                active={prepare.featureSelection === value}
                onClick={() => set({ featureSelection: value })}
                label={label}
                desc={desc}
              />
            ))}
          </div>

          {prepare.featureSelection === 'kbest' && (
            <label className="flex flex-col gap-1 max-w-xs">
              <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">K (features to keep)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={prepare.kBestK}
                onChange={(e) => set({ kBestK: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body"
              />
            </label>
          )}

          {prepare.featureSelection === 'variance' && (
            <label className="flex flex-col gap-1 max-w-xs">
              <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Variance Threshold</span>
              <input
                type="number"
                min={0}
                step={0.001}
                value={prepare.varianceThreshold}
                onChange={(e) => set({ varianceThreshold: parseFloat(e.target.value || '0') })}
                className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body"
              />
              <span className="text-[10px] text-echo-dim font-body">Features with variance ≤ this are dropped.</span>
            </label>
          )}

          {prepare.featureSelection === 'correlation' && (
            <label className="flex flex-col gap-1 max-w-xs">
              <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Correlation Threshold</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={prepare.correlationThreshold}
                onChange={(e) => set({ correlationThreshold: parseFloat(e.target.value || '0.95') })}
                className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body"
              />
              <span className="text-[10px] text-echo-dim font-body">
                For each pair with |r| above this, the second column is dropped.
              </span>
            </label>
          )}

          {prepare.featureSelection === 'manual' && (
            loading ? (
              <p className="text-xs text-echo-dim font-body">Loading columns…</p>
            ) : columns.length > 0 ? (
              <div className="mt-2">
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">
                    {prepare.selectedCols.length === 0
                      ? 'No columns selected — all will be used'
                      : `${prepare.selectedCols.length} column(s) selected`}
                  </span>
                  <button
                    onClick={() => set({ selectedCols: allManualSelected ? [] : [...columns] })}
                    className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-green hover:text-white transition-colors"
                  >
                    {allManualSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
                  {columns.map((col) => (
                    <label
                      key={col}
                      className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-xs transition-colors ${
                        prepare.selectedCols.includes(col)
                          ? 'border-echo-green bg-echo-green/10 text-echo-green'
                          : 'border-echo-border bg-echo-surface-2 text-echo-muted hover:border-echo-muted hover:text-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={prepare.selectedCols.includes(col)}
                        onChange={() => toggleCol(col, 'selectedCols')}
                        className="accent-echo-green sr-only"
                      />
                      <span className="truncate font-body" title={col}>{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
};

export default MLPrepare;
