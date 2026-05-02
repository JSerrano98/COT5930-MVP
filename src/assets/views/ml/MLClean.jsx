import { useEffect, useState } from 'react';

const BACKEND = 'http://localhost:8000';

const ACTION_OPTIONS = [
  { value: 'keep',        label: 'Keep as-is' },
  { value: 'fill_mean',   label: 'Fill nulls → Mean' },
  { value: 'fill_median', label: 'Fill nulls → Median' },
  { value: 'fill_mode',   label: 'Fill nulls → Mode' },
  { value: 'fill_zero',   label: 'Fill nulls → 0' },
  { value: 'drop_rows',   label: 'Drop rows with null' },
  { value: 'drop',        label: 'Drop column' },
];

const Badge = ({ children, color }) => {
  const colors = {
    gray:   'bg-stone-100 text-stone-500',
    yellow: 'bg-yellow-50 text-yellow-700',
    red:    'bg-red-50 text-red-600',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[color] ?? colors.gray}`}>
      {children}
    </span>
  );
};

const MLClean = ({ intake, onIntakeChange, onBack, onContinue }) => {
  const [profile, setProfile]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [dropDuplicates, setDropDuplicates] = useState(false);
  const [ops, setOps]                     = useState({});   // { colName: action }
  const [applying, setApplying]           = useState(false);
  const [cleanResult, setCleanResult]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${BACKEND}/ml/workbench/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_path: intake.datasetPath }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.detail) throw new Error(data.detail);
        setProfile(data);
        // default all cols to 'keep'
        const defaults = {};
        (data.columns ?? []).forEach((c) => { defaults[c.name] = 'keep'; });
        setOps(defaults);
      })
      .catch((e) => { if (!cancelled) setError(String(e.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [intake.datasetPath]);

  const setOp = (col, action) => setOps((prev) => ({ ...prev, [col]: action }));

  const apply = async () => {
    setApplying(true);
    setError('');
    setCleanResult(null);
    try {
      const column_ops = Object.entries(ops)
        .filter(([, action]) => action !== 'keep')
        .map(([col, action]) => ({ col, action }));

      const res  = await fetch(`${BACKEND}/ml/workbench/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_path: intake.datasetPath,
          drop_duplicates: dropDuplicates,
          column_ops,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Cleaning failed');

      // update the dataset path to the cleaned file for downstream steps
      onIntakeChange({ datasetPath: data.cleaned_path });
      setCleanResult(data);
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-stone-100">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-stone-200 bg-white px-6 py-4 shadow-sm">
        <button
          onClick={onBack}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-lg font-semibold text-stone-900">Data Cleaning</h1>
          <p className="text-xs text-stone-500">
            {intake.datasetPath.split(/[\\/]/).pop()}
            {profile && ` · ${profile.rows} rows · ${profile.columns?.length} columns`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onContinue}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Skip →
          </button>
          {cleanResult ? (
            <button
              onClick={onContinue}
              className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={apply}
              disabled={applying || loading || !profile}
              className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {applying ? 'Applying…' : 'Apply & Continue'}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <p className="text-sm text-stone-500">Loading dataset profile…</p>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {cleanResult && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            <p className="font-semibold">Cleaning applied ✓</p>
            <p className="mt-1 text-xs text-emerald-700">
              {cleanResult.original_rows} → {cleanResult.cleaned_rows} rows
              &nbsp;({cleanResult.dropped_rows} removed)
              {cleanResult.dropped_cols > 0 && `, ${cleanResult.dropped_cols} column(s) dropped`}
            </p>
            <p className="mt-1 break-all text-[11px] text-emerald-600">
              Saved to: {cleanResult.cleaned_path}
            </p>
          </div>
        )}

        {profile && (
          <>
            {/* Global options */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-5 py-3 shadow-sm">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={dropDuplicates}
                  onChange={(e) => setDropDuplicates(e.target.checked)}
                  className="rounded border-stone-300 accent-emerald-500"
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

            {/* Columns table */}
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-2.5 font-semibold">Column</th>
                    <th className="px-4 py-2.5 font-semibold">Type</th>
                    <th className="px-4 py-2.5 font-semibold">Nulls</th>
                    <th className="px-4 py-2.5 font-semibold">Unique</th>
                    <th className="px-4 py-2.5 font-semibold">Sample values</th>
                    <th className="px-4 py-2.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.columns.map((col, i) => (
                    <tr
                      key={col.name}
                      className={`border-b border-stone-50 last:border-none ${i % 2 === 1 ? 'bg-stone-50/50' : ''}`}
                    >
                      <td className="max-w-[160px] truncate px-4 py-2.5 font-medium text-stone-900" title={col.name}>
                        {col.name}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-stone-500">{col.dtype}</td>
                      <td className="px-4 py-2.5">
                        <Badge color={nullBadgeColor(col.null_pct)}>
                          {col.null_count} ({col.null_pct}%)
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-stone-500">{col.unique_count}</td>
                      <td className="max-w-[180px] truncate px-4 py-2.5 text-[11px] text-stone-400" title={col.sample.join(', ')}>
                        {col.sample.join(', ')}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={ops[col.name] ?? 'keep'}
                          onChange={(e) => setOp(col.name, e.target.value)}
                          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-800 outline-none focus:border-emerald-400"
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
