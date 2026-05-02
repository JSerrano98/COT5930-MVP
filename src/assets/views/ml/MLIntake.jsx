import { useEffect } from 'react';

/**
 * MLIntake — Step 1 of the ML workflow.
 * User picks: dataset, save directory, and task type (regression/classification).
 */
const MLIntake = ({ intake, onChange, onContinue }) => {
  const isElectron = Boolean(window.echo?.pickFile);

  useEffect(() => {
    if (!window.echo?.getDefaultModelPath) return;
    if (intake.saveDir?.trim()) return;

    window.echo.getDefaultModelPath()
      .then((defaultPath) => {
        if (defaultPath && !intake.saveDir?.trim()) {
          onChange({ saveDir: defaultPath });
        }
      })
      .catch(() => {});
  }, [intake.saveDir, onChange]);

  const browseDataset = async () => {
    if (!window.echo?.pickFile) return;
    const picked = await window.echo.pickFile({
      defaultPath: intake.datasetPath || undefined,
      filters: [{ name: 'CSV Datasets', extensions: ['csv'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (picked) onChange({ datasetPath: picked });
  };

  const browseSaveDir = async () => {
    if (!window.echo?.pickFolder) {
      // fallback: let them type a path
      return;
    }
    const defaultPath = intake.saveDir || (await window.echo.getDefaultModelPath?.()) || undefined;
    const picked = await window.echo.pickFolder(defaultPath);
    if (picked) onChange({ saveDir: picked });
  };

  const canContinue = intake.datasetPath.trim() && intake.taskType;

  return (
    <div className="flex h-full w-full items-center justify-center bg-stone-100 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-8 shadow-md">
        <h1 className="text-2xl font-bold text-stone-900">New Training Job</h1>
        <p className="mt-1 text-sm text-stone-500">
          Configure your dataset and task before selecting a model.
        </p>

        {/* Dataset */}
        <div className="mt-8 flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Dataset (CSV)
          </label>
          <div className="flex gap-2">
            <input
              value={intake.datasetPath}
              onChange={(e) => onChange({ datasetPath: e.target.value })}
              placeholder="path/to/dataset.csv"
              className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white"
            />
            {isElectron && (
              <button
                onClick={browseDataset}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50"
              >
                Browse
              </button>
            )}
          </div>
          {!isElectron && (
            <span className="text-[11px] text-stone-400">
              Enter a path relative to the backend root (e.g. data/CSV/file.csv).
            </span>
          )}
        </div>

        {/* Model name */}
        <div className="mt-5 flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Model Name
          </label>
          <input
            value={intake.modelName ?? ''}
            onChange={(e) => onChange({ modelName: e.target.value })}
            placeholder="e.g. Heart Rate Predictor (optional)"
            className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white"
          />
          <span className="text-[11px] text-stone-400">
            Used to identify this model in the dashboard. Optional.
          </span>
        </div>

        {/* Save directory */}
        <div className="mt-5 flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Save Trained Model To
          </label>
          <div className="flex gap-2">
            <input
              value={intake.saveDir}
              onChange={(e) => onChange({ saveDir: e.target.value })}
              placeholder="Defaults to Documents/ECHO Trained Models"
              className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white"
            />
            {isElectron && window.echo?.pickFolder && (
              <button
                onClick={browseSaveDir}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50"
              >
                Browse
              </button>
            )}
          </div>
          <span className="text-[11px] text-stone-400">
            Default folder is created automatically if missing.
          </span>
        </div>

        {/* Task type */}
        <div className="mt-8 flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Task Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                key: 'regression',
                title: 'Regression',
                desc: 'Predict a continuous value (e.g. heart rate, stress score)',
              },
              {
                key: 'classification',
                title: 'Classification',
                desc: 'Predict a discrete label or category (e.g. emotion, state)',
              },
            ].map(({ key, title, desc }) => {
              const active = intake.taskType === key;
              return (
                <button
                  key={key}
                  onClick={() => onChange({ taskType: key })}
                  className={[
                    'rounded-xl border p-4 text-left transition-colors',
                    active
                      ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                      : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-white',
                  ].join(' ')}
                >
                  <p className={`font-semibold ${active ? 'text-emerald-700' : 'text-stone-800'}`}>
                    {title}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">{desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <button
          disabled={!canContinue}
          onClick={onContinue}
          className="mt-8 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
    </div>
  );
};

export default MLIntake;
