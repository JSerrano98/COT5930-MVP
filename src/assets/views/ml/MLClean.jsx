import { useEffect, useState } from 'react';

const BACKEND = 'http://localhost:8000';

const CLEAN_CACHE_KEY = 'echo_ml_clean_cache';

const loadCleanCache = (path) => {
  try {
    const cache = JSON.parse(localStorage.getItem(CLEAN_CACHE_KEY) ?? 'null');
    return cache?.datasetPath === path ? cache : null;
  } catch { return null; }
};

const saveCleanCache = (data) => {
  try { localStorage.setItem(CLEAN_CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
};

const ACTION_OPTIONS = [
  { value: 'keep',        label: 'Keep as-is' },
  { value: 'fill_mean',   label: 'Fill nulls: Mean' },
  { value: 'fill_median', label: 'Fill nulls: Median' },
  { value: 'fill_mode',   label: 'Fill nulls: Mode' },
  { value: 'fill_zero',   label: 'Fill nulls: 0' },
  { value: 'drop_rows',   label: 'Drop rows with null' },
  { value: 'drop',        label: 'Drop column' },
];

const Badge = ({ children, color }) => {
  const colors = {
    gray:   'bg-echo-border text-echo-muted',
    yellow: 'bg-amber-500/15 text-amber-400',
    red:    'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 text-[9px] font-ui font-semibold tracking-widest uppercase ${colors[color] ?? colors.gray}`}>
      {children}
    </span>
  );
};

const ProgressBar = ({ pct, label }) => (
  <div className="flex flex-col gap-2 py-6">
    <div className="flex items-center justify-between">
      {label && <p className="text-[10px] font-ui font-semibold uppercase tracking-widest text-echo-muted">{label}</p>}
      <p className="text-[10px] font-ui font-semibold text-echo-green ml-2 tabular-nums">{pct}%</p>
    </div>
    <div className="h-0.5 w-full bg-echo-border">
      <div
        className="h-full bg-echo-green transition-[width] duration-150"
        style={{ width: `${pct}%` }}
      />
    </div>
  </div>
);

const MLClean = ({ intake, onIntakeChange, onBack, onContinue }) => {
  const [profile, setProfile]               = useState(() => loadCleanCache(intake.datasetPath)?.profile ?? null);
  const [loading, setLoading]               = useState(() => !loadCleanCache(intake.datasetPath)?.profile);
  const [error, setError]                   = useState('');
  const [dropDuplicates, setDropDuplicates] = useState(() => loadCleanCache(intake.datasetPath)?.dropDuplicates ?? false);
  const [ops, setOps]                       = useState(() => loadCleanCache(intake.datasetPath)?.ops ?? {});   // { colName: action }
  const [bulkAction, setBulkAction]         = useState('fill_mean');
  const [applying, setApplying]             = useState(false);
  const [cleanResult, setCleanResult]       = useState(() => loadCleanCache(intake.datasetPath)?.cleanResult ?? null);
  const [profileProgress, setProfileProgress] = useState({ pct: 0, label: '' });
  const [applyProgress, setApplyProgress]     = useState({ pct: 0, label: '' });

  useEffect(() => {
    const cached = loadCleanCache(intake.datasetPath);
    if (cached?.profile) {
      setProfile(cached.profile);
      setOps(cached.ops ?? {});
      setDropDuplicates(cached.dropDuplicates ?? false);
      setCleanResult(cached.cleanResult ?? null);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setProfileProgress({ pct: 0, label: 'Starting…' });
    setError('');
    setProfile(null);
    setOps({});
    setDropDuplicates(false);

    (async () => {
      try {
        const res = await fetch(`${BACKEND}/ml/workbench/profile/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset_path: intake.datasetPath }),
        });
        if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const evt = JSON.parse(line.slice(6));
            if (cancelled) return;
            if (evt.error) throw new Error(evt.error);
            setProfileProgress({ pct: evt.pct, label: evt.label });
            if (evt.result !== undefined) {
              const data = evt.result;
              setProfile(data);
              const defaults = {};
              (data.columns ?? []).forEach((c) => { defaults[c.name] = 'keep'; });
              setOps(defaults);
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [intake.datasetPath]);

  useEffect(() => {
    if (!profile) return;
    saveCleanCache({ datasetPath: intake.datasetPath, profile, ops, dropDuplicates, cleanResult });
  }, [intake.datasetPath, profile, ops, dropDuplicates, cleanResult]);

  const setOp = (col, action) => setOps((prev) => ({ ...prev, [col]: action }));

  const applyBulkAction = (action) => {
    if (!profile?.columns?.length) return;
    setOps((prev) => {
      const next = { ...prev };
      profile.columns.forEach((col) => {
        if (col.null_count > 0) next[col.name] = action;
      });
      return next;
    });
  };

  const apply = async () => {
    setApplying(true);
    setApplyProgress({ pct: 0, label: 'Starting…' });
    setError('');
    setCleanResult(null);
    try {
      const column_ops = Object.entries(ops)
        .filter(([, action]) => action !== 'keep')
        .map(([col, action]) => ({ col, action }));

      const res = await fetch(`${BACKEND}/ml/workbench/clean/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_path: intake.datasetPath,
          drop_duplicates: dropDuplicates,
          column_ops,
          clean_dir: localStorage.getItem('echo_cleaned_dir') || '',
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const evt = JSON.parse(line.slice(6));
          if (evt.error) throw new Error(evt.error);
          setApplyProgress({ pct: evt.pct, label: evt.label });
          if (evt.result !== undefined) {
            onIntakeChange({ datasetPath: evt.result.cleaned_path });
            setCleanResult(evt.result);
          }
        }
      }
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setApplying(false);
    }
  };

  const nullBadgeColor = (pct) => {
    if (pct === 0) return 'gray';
    if (pct < 10)  return 'yellow';
    return 'red';
  };

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
        
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onContinue}
            className="border border-echo-border px-3 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase text-echo-muted hover:border-echo-muted hover:text-white transition-colors"
          >
            Skip
          </button>
          {cleanResult ? (
            <button
              onClick={onContinue}
              className="border border-echo-green px-4 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase text-echo-green bg-echo-green/10 hover:bg-echo-green/20 transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={apply}
              disabled={applying || loading || !profile}
              className="border border-echo-green px-4 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase text-echo-green bg-echo-green/10 hover:bg-echo-green/20 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {applying ? 'Applying…' : 'Apply & Continue'}
            </button>
          )}
        </div>
      </div>

      {/* Apply progress bar */}
      {applying && (
        <div className="px-6 pt-3 flex-shrink-0">
          <ProgressBar pct={applyProgress.pct} label={applyProgress.label} />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <ProgressBar pct={profileProgress.pct} label={profileProgress.label} />
        )}
        {error && (
          <div className="mb-4 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-body">
            {error}
          </div>
        )}

        {cleanResult && (
          <div className="mb-4 flex items-center gap-3 border border-echo-border bg-echo-surface px-5 py-3">
            <p className="font-ui font-semibold tracking-widest uppercase text-[10px]">Cleaning Applied</p>
            <p className="mt-1 text-xs">
              {cleanResult.original_rows} {cleanResult.cleaned_rows} rows
              &nbsp;({cleanResult.dropped_rows} removed)
              {cleanResult.dropped_cols > 0 && `, ${cleanResult.dropped_cols} column(s) dropped`}
            </p>
            <p className="mt-1 break-all text-[11px] opacity-80">
              Saved to: {cleanResult.cleaned_path}
            </p>
          </div>
        )}

        {profile && (
          <>
            {/* Global options */}
            <div className="mb-4 flex items-center gap-3 border border-echo-border bg-echo-surface px-5 py-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white font-body">
                <input
                  type="checkbox"
                  checked={dropDuplicates}
                  onChange={(e) => setDropDuplicates(e.target.checked)}
                  className="border-echo-border accent-echo-green"
                />
                Drop duplicate rows
              </label>
              {profile.duplicate_rows > 0 && (
                <Badge color="yellow">{profile.duplicate_rows} duplicate{profile.duplicate_rows !== 1 ? 's' : ''} found</Badge>
              )}
              {profile.duplicate_rows === 0 && (
                <Badge color="gray">No duplicates</Badge>
              )}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2 border border-echo-border bg-echo-surface px-5 py-3">
              <span className="text-[9px] font-ui font-semibold uppercase tracking-widest text-echo-muted">Null Handling</span>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="border border-echo-border bg-echo-surface-2 px-2 py-1.5 text-[11px] text-white font-body outline-none focus:border-echo-green"
              >
                {ACTION_OPTIONS.filter((opt) => opt.value !== 'keep').map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => applyBulkAction(bulkAction)}
                className="border border-echo-border px-3 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase text-echo-muted hover:border-echo-muted hover:text-white transition-colors"
              >
                Apply To All Null Columns
              </button>
              <button
                onClick={() => applyBulkAction('drop_rows')}
                className="border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-[10px] font-ui font-semibold tracking-widest uppercase text-red-300 hover:bg-red-500/20 transition-colors"
              >
                Drop NaNs
              </button>
            </div>

            {/* Columns table */}
            <div className="overflow-hidden border border-echo-border bg-echo-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-echo-border bg-echo-surface-2 text-left">
                    <th className="px-4 py-2.5">Column</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Nulls</th>
                    <th className="px-4 py-2.5">Unique</th>
                    <th className="px-4 py-2.5">Sample values</th>
                    <th className="px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.columns.map((col, i) => (
                    <tr
                      key={col.name}
                      className={`border-b border-echo-border-2 last:border-none ${
                        i % 2 === 1 ? 'bg-echo-surface-2/40' : ''
                      }`}
                    >
                      <td className="max-w-[160px] truncate px-4 py-2.5 font-ui font-medium text-white" title={col.name}>
                        {col.name}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-echo-dim font-body">{col.dtype}</td>
                      <td className="px-4 py-2.5">
                        <Badge color={nullBadgeColor(col.null_pct)}>
                          {col.null_count} ({col.null_pct}%)
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-echo-muted font-body">{col.unique_count}</td>
                      <td className="max-w-[180px] truncate px-4 py-2.5 text-[10px] text-echo-dim font-body" title={col.sample.join(', ')}>
                        {col.sample.join(', ')}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={ops[col.name] ?? 'keep'}
                          onChange={(e) => setOp(col.name, e.target.value)}
                          className="border border-echo-border bg-echo-surface-2 px-2 py-1 text-[11px] text-white font-body outline-none focus:border-echo-green"
                        >
                          {ACTION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MLClean;