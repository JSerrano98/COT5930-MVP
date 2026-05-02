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
  <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
    <p className="text-[10px] uppercase tracking-wider text-stone-500">{title}</p>
    <p className="mt-1 text-lg font-semibold text-stone-900">{value}</p>
  </div>
);

const formatMetric = (value) => {
  if (value === null || value === undefined) return '--';
  if (typeof value !== 'number') return String(value);
  return value.toFixed(4);
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
        save_dir: intake.saveDir ?? '',
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
    ? 'text-blue-600 bg-blue-50 border-blue-200'
    : 'text-violet-600 bg-violet-50 border-violet-200';

  return (
    <div className="h-full w-full overflow-auto bg-stone-100 p-6 text-stone-900">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm hover:border-stone-400 hover:bg-stone-50"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Model Workbench</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-stone-500">
            <span className="max-w-[240px] truncate" title={intake.datasetPath}>
              {intake.datasetPath.split(/[\\/]/).pop()}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${taskColor}`}>
              {taskLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid min-h-full w-full grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-sm xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-stone-500">Model</span>
              <select
                value={modelKey}
                onChange={(e) => onModelChange(e.target.value)}
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-stone-500"
              >
                {Object.entries(filteredModels).map(([key, spec]) => (
                  <option key={key} value={key}>{spec.label}</option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 shadow-sm">
              <p>Dataset: <span className="break-all font-semibold text-stone-900">{intake.datasetPath.split(/[\\/]/).pop()}</span></p>
              <p className="mt-1">Rows: <span className="font-semibold text-stone-900">{datasetRows ?? '—'}</span></p>
              {!columnsLoaded && (
                <button onClick={loadColumns} disabled={loading} className="mt-2 text-[11px] text-emerald-600 underline disabled:opacity-50">
                  Load columns
                </button>
              )}
            </div>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs uppercase tracking-wide text-stone-500">Label Column</span>
              {columns.length > 0 ? (
                <select
                  value={labelCol}
                  onChange={(e) => setLabelCol(e.target.value)}
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-stone-500"
                >
                  {columns.map((col) => (<option key={col} value={col}>{col}</option>))}
                </select>
              ) : (
                <input
                  value={labelCol}
                  onChange={(e) => setLabelCol(e.target.value)}
                  placeholder="target"
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none placeholder:text-stone-400 focus:border-stone-500"
                />
              )}
            </label>
          </div>

          {modelSpec?.params && Object.keys(modelSpec.params).length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">Model Parameters</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {Object.entries(modelSpec.params).map(([key, meta]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-stone-500">{key}</span>
                    {meta.type === 'enum' ? (
                      <select
                        value={params[key] ?? meta.default}
                        onChange={(e) => setParams((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-stone-500"
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
                        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-stone-500"
                      />
                    )}
                  </label>
                ))}
              </div>
            </>
          )}

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">Split Settings</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-stone-500">Test Size</span>
              <input type="number" min="0.05" max="0.45" step="0.05" value={split.test_size}
                onChange={(e) => setSplit((prev) => ({ ...prev, test_size: Number.parseFloat(e.target.value || '0.2') }))}
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-stone-500" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-stone-500">Val Size</span>
              <input type="number" min="0" max="0.35" step="0.05" value={split.val_size}
                onChange={(e) => setSplit((prev) => ({ ...prev, val_size: Number.parseFloat(e.target.value || '0.1') }))}
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-stone-500" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-stone-500">Random State</span>
              <input type="number" step="1" value={split.random_state}
                onChange={(e) => setSplit((prev) => ({ ...prev, random_state: Number.parseInt(e.target.value || '42', 10) }))}
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-stone-500" />
            </label>
            <label className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm">
              <input type="checkbox" checked={split.shuffle}
                onChange={(e) => setSplit((prev) => ({ ...prev, shuffle: e.target.checked }))} />
              Shuffle
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={train} disabled={loading || !labelCol}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:border-emerald-400 hover:bg-emerald-100 disabled:opacity-50">
              {loading ? 'Training…' : 'Train Model'}
            </button>
            <button onClick={() => { setResult(null); setError(''); }}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 shadow-sm hover:border-stone-400 hover:bg-stone-50">
              Clear Output
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Training Output</h2>
          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {result ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs text-stone-700 shadow-sm">
                <p>Model: <span className="font-semibold text-stone-900">{result.model_name}</span></p>
                <p className="mt-1 break-all">Saved to: <span className="font-mono text-stone-900">{result.model_path}</span></p>
                <p className="mt-1">Task: <span className="font-semibold text-stone-900">{result.task}</span></p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <StatCard title="Train" value={formatMetric(result.metrics?.train?.accuracy ?? result.metrics?.train?.r2)} />
                <StatCard title="Validation" value={formatMetric(result.metrics?.val?.accuracy ?? result.metrics?.val?.r2)} />
                <StatCard title="Test" value={formatMetric(result.metrics?.test?.accuracy ?? result.metrics?.test?.r2)} />
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg border border-stone-200 bg-white p-3 text-xs text-stone-700 shadow-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No model trained yet.</p>
          )}
        </section>
      </div>
    </div>
  );
};

// Root orchestrator
const DEFAULT_INTAKE = { datasetPath: '', saveDir: '', taskType: '', modelName: '' };

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
