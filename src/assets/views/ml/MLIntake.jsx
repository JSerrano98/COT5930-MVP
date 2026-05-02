const getModelsDir = () =>
  localStorage.getItem('echo_models_dir') || 'backend/ml_models';

/**
 * MLIntake — Step 1 of the ML workflow.
 * User picks: dataset and task type. Save directory comes from Settings.
 */
const MLIntake = ({ intake, onChange, onContinue }) => {
  const isElectron = Boolean(window.echo?.pickFile);

  const browseDataset = async () => {
    if (!window.echo?.pickFile) return;
    const picked = await window.echo.pickFile({
      defaultPath: intake.datasetPath || undefined,
      filters: [{ name: 'CSV Datasets', extensions: ['csv'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (picked) onChange({ datasetPath: picked });
  };

  const canContinue = intake.datasetPath.trim() && intake.taskType;

  return (
    <div className="flex h-full w-full items-center justify-center bg-echo-bg p-6">
      <div className="w-full max-w-lg border border-echo-border bg-echo-surface p-8">
        {/* Corner accents */}
        <div className="relative mb-6">
          <h1 className="font-title text-4xl tracking-[0.1em] text-white px-8 pt-4">NEW TRAINING JOB</h1>
          <p className="mt-1 text-xs text-echo-muted font-body px-8 pb-2">
            Configure your dataset and task before selecting a model.
          </p>
        </div>

        {/* Dataset */}
        <div className="mt-4 flex flex-col gap-1">
          <label className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">
            Dataset (CSV)
          </label>
          <div className="flex gap-1">
            <input
              value={intake.datasetPath}
              onChange={(e) => onChange({ datasetPath: e.target.value })}
              placeholder="path/to/dataset.csv"
              className="flex-1 bg-echo-surface-2 border border-echo-border text-white px-3 py-2 text-sm focus:border-echo-green font-body"
            />
            {isElectron && (
              <button
                onClick={browseDataset}
                className="border border-echo-border bg-echo-surface-2 px-3 py-2 text-[10px] font-ui font-semibold tracking-widest uppercase text-echo-muted hover:border-echo-muted hover:text-white transition-colors"
              >
                Browse
              </button>
            )}
          </div>
          {!isElectron && (
            <span className="text-[10px] text-echo-dim font-body">
              Enter a path relative to the backend root (e.g. data/CSV/file.csv).
            </span>
          )}
        </div>

        {/* Model name */}
        <div className="mt-4 flex flex-col gap-1">
          <label className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">
            Model Name
          </label>
          <input
            value={intake.modelName ?? ''}
            onChange={(e) => onChange({ modelName: e.target.value })}
            placeholder="e.g. Heart Rate Predictor (optional)"
            className="bg-echo-surface-2 border border-echo-border text-white px-3 py-2 text-sm focus:border-echo-green font-body"
          />
          <span className="text-[10px] text-echo-dim font-body">Used to identify this model in the dashboard. Optional.</span>
        </div>

        {/* Task type */}
        <div className="mt-6 flex flex-col gap-3">
          <label className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">
            Task Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'regression', title: 'Regression', desc: 'Predict a continuous value (e.g. heart rate, stress score)' },
              { key: 'classification', title: 'Classification', desc: 'Predict a discrete label or category (e.g. emotion, state)' },
            ].map(({ key, title, desc }) => {
              const active = intake.taskType === key;
              return (
                <button
                  key={key}
                  onClick={() => onChange({ taskType: key })}
                  className={`border p-4 text-left transition-colors ${
                    active
                      ? 'border-echo-green bg-echo-green/10'
                      : 'border-echo-border bg-echo-surface-2 hover:border-echo-muted'
                  }`}
                >
                  <p className={`font-ui font-semibold text-sm ${
                    active ? 'text-echo-green' : 'text-white'
                  }`}>
                    {title}
                  </p>
                  <p className="mt-1 text-[10px] text-echo-muted font-body">{desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <button
          disabled={!canContinue}
          onClick={onContinue}
          className="mt-8 w-full px-4 py-3 text-[11px] font-ui font-semibold tracking-widest uppercase border border-echo-green text-echo-green bg-echo-green/10 hover:bg-echo-green/20 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default MLIntake;
