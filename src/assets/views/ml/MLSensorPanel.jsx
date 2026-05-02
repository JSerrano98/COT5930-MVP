import { useEffect, useState } from 'react';

const BACKEND = 'http://localhost:8000';

let _uidCounter = 1;
const genUid = () => `ml_sensor_${Date.now()}_${_uidCounter++}`;

const DEFAULT_FORM = {
  name: '',
  sourceName: '',
  modelPath: '',
  sourceType: '',
  bufferSeconds: 2.0,
  processInterval: 0.1,
};

/**
 * MLSensorPanel — lets users load a trained model as a live LSL sensor
 * that reads from an existing stream and pushes predictions.
 */
const MLSensorPanel = () => {
  const [sensors, setSensors]   = useState([]);
  const [form, setForm]         = useState(DEFAULT_FORM);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const isElectron = Boolean(window.echo?.pickFile);

  const refresh = async () => {
    try {
      const res  = await fetch(`${BACKEND}/ml-sensors`);
      const data = await res.json();
      setSensors(data.sensors ?? []);
    } catch {
      /* backend may not be running yet */
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  const browseModel = async () => {
    if (!window.echo?.pickFile) return;
    const picked = await window.echo.pickFile({
      defaultPath: form.modelPath || undefined,
      filters: [{ name: 'Trained Models', extensions: ['pkl'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (picked) setForm((prev) => ({ ...prev, modelPath: picked }));
  };

  const startSensor = async () => {
    if (!form.name || !form.sourceName || !form.modelPath) {
      setError('Name, Source Stream, and Model Path are required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        uid:              genUid(),
        name:             form.name,
        source_name:      form.sourceName,
        model_path:       form.modelPath,
        source_type:      form.sourceType,
        buffer_seconds:   form.bufferSeconds,
        process_interval: form.processInterval,
      };

      const res  = await fetch(`${BACKEND}/ml-sensors/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Failed to start sensor');
      setForm(DEFAULT_FORM);
      await refresh();
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  const stopSensor = async (uid) => {
    try {
      await fetch(`${BACKEND}/ml-sensors/${uid}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(String(err.message ?? err));
    }
  };

  return (
    <div className="h-full w-full overflow-auto bg-stone-100 p-6 text-stone-900">
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Left: create form */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold text-stone-900">Load Model as Sensor</h2>
          <p className="mt-1 text-sm text-stone-500">
            Attach a trained model to a live LSL stream. Predictions will be published as a new LSL stream in real time.
          </p>

          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-stone-500">Sensor Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. StressPredictor"
                className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-stone-500">Source LSL Stream Name</span>
              <input
                value={form.sourceName}
                onChange={(e) => setForm((prev) => ({ ...prev, sourceName: e.target.value }))}
                placeholder="e.g. EEG_AlphaPower"
                className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs uppercase tracking-wide text-stone-500">Model File (.pkl)</span>
              <div className="flex gap-2">
                <input
                  value={form.modelPath}
                  onChange={(e) => setForm((prev) => ({ ...prev, modelPath: e.target.value }))}
                  placeholder="path/to/model.pkl"
                  className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white"
                />
                {isElectron && (
                  <button
                    onClick={browseModel}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50"
                  >
                    Browse
                  </button>
                )}
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-stone-500">Source Type (optional)</span>
              <input
                value={form.sourceType}
                onChange={(e) => setForm((prev) => ({ ...prev, sourceType: e.target.value }))}
                placeholder="EEG, ECG, … (leave blank for any)"
                className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-stone-500">Buffer (seconds)</span>
              <input
                type="number" min="0.5" step="0.5"
                value={form.bufferSeconds}
                onChange={(e) => setForm((prev) => ({ ...prev, bufferSeconds: Number.parseFloat(e.target.value || '2') }))}
                className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none focus:border-emerald-400 focus:bg-white"
              />
            </label>
          </div>

          <button
            onClick={startSensor}
            disabled={loading}
            className="mt-6 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-40"
          >
            {loading ? 'Starting…' : 'Start Sensor'}
          </button>
        </section>

        {/* Right: active sensors */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Active ML Sensors</h2>
            <button onClick={refresh} className="text-xs text-stone-400 hover:text-stone-600">↻ Refresh</button>
          </div>

          {sensors.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">No ML sensors running.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {sensors.map((s) => (
                <li key={s.uid} className="rounded-lg border border-stone-200 p-3 text-xs text-stone-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 truncate">{s.name}</p>
                      <p className="mt-0.5 text-stone-500 truncate">← {s.source_name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-stone-400 break-all">{s.model_path}</p>
                    </div>
                    <button
                      onClick={() => stopSensor(s.uid)}
                      className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100"
                    >
                      Stop
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${s.running ? 'bg-emerald-400' : 'bg-stone-300'}`} />
                    <span className="text-stone-400">{s.running ? 'Streaming' : 'Stopped'} · {s.channels}ch</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default MLSensorPanel;
