import { useEffect, useMemo, useState } from 'react';
import MLIntake from './MLIntake';
import MLClean from './MLClean';

const BACKEND = 'http://localhost:8000';

const DEFAULT_SPLIT = {
  test_size: 0.2,
  val_size: 0.1,
  random_state: 42,
  shuffle: true,
};

const buildDefaultParams = (schema = {}) => {
  const out = {};
  Object.entries(schema).forEach(([key, meta]) => { out[key] = meta.default; });
  return out;
};

const StatCard = ({ title, value }) => (
  <div className="border border-echo-border bg-echo-surface-2 p-3">
    <p className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">{title}</p>
    <p className="mt-1 text-lg font-ui font-semibold text-white">{value}</p>
  </div>
);

const formatMetric = (value) => {
  if (value === null || value === undefined) return '--';
  if (typeof value !== 'number') return String(value);
  return value.toFixed(4);
};

const getModelsDir = () =>
  localStorage.getItem('echo_models_dir') || 'backend/ml_models';

const getModelFilePreview = (modelName, modelKey) => {
  const rawName = (modelName?.trim() || modelKey || 'model').replace(/\s+/g, '_');
  return `${rawName}.pkl`;
};

// Configure + Train step
const MLTrainForm = ({ intake, onBack }) => {
  const [models, setModels]           = useState({});
  const [modelKey, setModelKey]       = useState('');
  const [params, setParams]           = useState({});
  const [labelCol, setLabelCol]       = useState('');
  const [split, setSplit]             = useState(DEFAULT_SPLIT);
  const [columns, setColumns]         = useState([]);
  const [datasetRows, setDatasetRows] = useState(null);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [columnsLoaded, setColumnsLoaded] = useState(false);

  const filteredModels = useMemo(
    () => Object.fromEntries(Object.entries(models).filter(([, spec]) => spec.task === intake.taskType)),
    [models, intake.taskType]
  );

  useEffect(() => {
    fetch(`${BACKEND}/ml/workbench/models`)
      .then((r) => r.json())
      .then((data) => {
        const all = data.models ?? {};
        setModels(all);
        const firstKey = Object.keys(all).find((k) => all[k].task === intake.taskType);
        if (firstKey) {
          setModelKey(firstKey);
          setParams(buildDefaultParams(all[firstKey]?.params));
        }
      })
      .catch((err) => setError(String(err.message ?? err)));
  }, [intake.taskType]);

  useEffect(() => {
    if (!intake.datasetPath || columnsLoaded) return;
    loadColumns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intake.datasetPath]);

  const modelSpec = useMemo(() => models[modelKey] ?? null, [models, modelKey]);

  const onModelChange = (nextKey) => {
    setModelKey(nextKey);
    setParams(buildDefaultParams(models[nextKey]?.params));
    setResult(null);
    setError('');
  };

  const loadColumns = async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BACKEND}/ml/workbench/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_path: intake.datasetPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Failed to load columns');
      setColumns(data.columns ?? []);
      setDatasetRows(data.rows ?? null);
      setColumnsLoaded(true);
      if (data.columns?.length) setLabelCol(data.columns[0]);
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  const train = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        dataset_path: intake.datasetPath,
        label_col: labelCol,
        model_key: modelKey,
        model_name: intake.modelName?.trim() || '',
        params,
        save_dir: localStorage.getItem('echo_models_dir') || 'backend/ml_models',
        ...split,
      };
      const res  = await fetch(`${BACKEND}/ml/workbench/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Training failed');
      setResult(data);
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  const taskLabel = intake.taskType === 'regression' ? 'Regression' : 'Classification';
  const taskColor = intake.taskType === 'regression'
    ? 'text-echo-blue border-echo-blue/40 bg-echo-blue/10'
    : 'text-purple-400 border-purple-500/40 bg-purple-500/10';
  const saveDir = getModelsDir();
  const saveFile = getModelFilePreview(intake.modelName, modelKey);

  return (
    <div className="h-full w-full overflow-auto bg-echo-bg">
      <div className="mx-auto w-full max-w-7xl px-6 py-6">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="border border-echo-border bg-echo-surface px-3 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase text-echo-muted hover:border-echo-muted hover:text-white transition-colors"
        >
          Back
        </button>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="border border-echo-border bg-echo-surface p-5 xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Model</span>
              <select
                value={modelKey}
                onChange={(e) => onModelChange(e.target.value)}
                className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body"
              >
                {Object.entries(filteredModels).map(([key, spec]) => (
                  <option key={key} value={key}>{spec.label}</option>
                ))}
              </select>
            </label>

            <div className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-xs text-echo-muted font-body">
              <p>Dataset: <span className="break-all font-ui font-semibold text-white">{intake.datasetPath.split(/[\/\\]/).pop()}</span></p>
              <p className="mt-1">Rows: <span className="font-ui font-semibold text-white">{datasetRows ?? '—'}</span></p>
              {!columnsLoaded && (
                <button onClick={loadColumns} disabled={loading} className="mt-2 text-[10px] text-echo-green underline disabled:opacity-50 font-ui">
                  Load columns
                </button>
              )}
            </div>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Label Column</span>
              {columns.length > 0 ? (
                <select
                  value={labelCol}
                  onChange={(e) => setLabelCol(e.target.value)}
                  className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body"
                >
                  {columns.map((col) => (<option key={col} value={col}>{col}</option>))}
                </select>
              ) : (
                <input
                  value={labelCol}
                  onChange={(e) => setLabelCol(e.target.value)}
                  placeholder="target"
                  className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body"
                />
              )}
            </label>
          </div>

          {modelSpec?.params && Object.keys(modelSpec.params).length > 0 && (
            <>
              <h2 className="mt-6 text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Model Parameters</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {Object.entries(modelSpec.params).map(([key, meta]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">{key}</span>
                    {meta.type === 'enum' ? (
                      <select
                        value={params[key] ?? meta.default}
                        onChange={(e) => setParams((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body"
                      >
                        {meta.options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                      </select>
                    ) : (
                      <input
                        type="number" min={meta.min} max={meta.max} step={meta.step ?? 1}
                        value={params[key] ?? meta.default}
                        onChange={(e) => setParams((prev) => ({
                          ...prev,
                          [key]: meta.type === 'int'
                            ? Number.parseInt(e.target.value || '0', 10)
                            : Number.parseFloat(e.target.value || '0'),
                        }))}
                        className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body"
                      />
                    )}
                  </label>
                ))}
              </div>
            </>
          )}

          <h2 className="mt-6 text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Split Settings</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Test Size</span>
              <input type="number" min="0.05" max="0.45" step="0.05" value={split.test_size}
                onChange={(e) => setSplit((prev) => ({ ...prev, test_size: Number.parseFloat(e.target.value || '0.2') }))}
                className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Val Size</span>
              <input type="number" min="0" max="0.35" step="0.05" value={split.val_size}
                onChange={(e) => setSplit((prev) => ({ ...prev, val_size: Number.parseFloat(e.target.value || '0.1') }))}
                className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Random State</span>
              <input type="number" step="1" value={split.random_state}
                onChange={(e) => setSplit((prev) => ({ ...prev, random_state: Number.parseInt(e.target.value || '42', 10) }))}
                className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-echo-green font-body" />
            </label>
            <label className="flex items-center gap-2 border border-echo-border bg-echo-surface-2 px-3 py-2 text-sm text-white font-body">
              <input type="checkbox" checked={split.shuffle}
                onChange={(e) => setSplit((prev) => ({ ...prev, shuffle: e.target.checked }))} className="accent-echo-green" />
              Shuffle
            </label>
          </div>

          <div className="mt-6 flex gap-2">
            <button onClick={train} disabled={loading || !labelCol}
              className="border border-echo-green text-echo-green bg-echo-green/10 px-4 py-2 text-[10px] font-ui font-semibold tracking-widest uppercase hover:bg-echo-green/20 transition-colors disabled:opacity-50">
              {loading ? 'Training…' : 'Train & Save Model'}
            </button>
            <button onClick={() => { setResult(null); setError(''); }}
              className="border border-echo-border text-echo-muted px-4 py-2 text-[10px] font-ui font-semibold tracking-widest uppercase hover:border-echo-muted hover:text-white transition-colors">
              Clear Output
            </button>
          </div>
        </section>

        <section className="border border-echo-border bg-echo-surface p-5">
          <h2 className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Training Output</h2>
          {error && (
            <div className="mt-3 border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400 font-body">{error}</div>
          )}
          {result ? (
            <div className="mt-4 space-y-3">
              <div className="border border-echo-border bg-echo-surface-2 p-3 text-xs text-echo-muted font-body">
                <p>Model: <span className="font-ui font-semibold text-white">{result.model_name}</span></p>
                <p className="mt-1 break-all">Saved to: <span className="font-body text-white">{result.model_path}</span></p>
                <p className="mt-1">Task: <span className="font-ui font-semibold text-white">{result.task}</span></p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <StatCard title="Train" value={formatMetric(result.metrics?.train?.accuracy ?? result.metrics?.train?.r2)} />
                <StatCard title="Validation" value={formatMetric(result.metrics?.val?.accuracy ?? result.metrics?.val?.r2)} />
                <StatCard title="Test" value={formatMetric(result.metrics?.test?.accuracy ?? result.metrics?.test?.r2)} />
              </div>
              <pre className="max-h-72 overflow-auto border border-echo-border bg-echo-surface-2 p-3 text-xs text-echo-muted font-body">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="mt-3 text-sm text-echo-dim font-body">No model trained yet.</p>
          )}
        </section>
      </div>
      </div>
    </div>
  );

};

// Root orchestrator
const DEFAULT_INTAKE = { datasetPath: '', taskType: '', modelName: '' };

const MachineLearning = () => {
  const [step, setStep]     = useState('intake');   // 'intake' | 'clean' | 'configure'
  const [intake, setIntake] = useState(DEFAULT_INTAKE);

  const handleIntakeChange = (patch) => setIntake((prev) => ({ ...prev, ...patch }));

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-hidden">
        {step === 'intake' && (
          <MLIntake intake={intake} onChange={handleIntakeChange} onContinue={() => setStep('clean')} />
        )}
        {step === 'clean' && (
          <MLClean
            intake={intake}
            onIntakeChange={handleIntakeChange}
            onBack={() => setStep('intake')}
            onContinue={() => setStep('configure')}
          />
        )}
        {step === 'configure' && (
          <MLTrainForm intake={intake} onBack={() => setStep('clean')} />
        )}
      </div>
    </div>
  );
};

export default MachineLearning;
