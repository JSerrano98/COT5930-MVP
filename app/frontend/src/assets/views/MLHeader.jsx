/**
 * MLHeader — toolbar for the ML pipeline view.
 * Displays pipeline name, status, and action buttons.
 */

const STATUS_LABEL = {
  idle:    { text: 'Idle',     cls: 'text-slate-500' },
  running: { text: 'Running',  cls: 'text-yellow-400 animate-pulse' },
  done:    { text: 'Done',     cls: 'text-emerald-400' },
  error:   { text: 'Error',    cls: 'text-red-400' },
};

const MLHeader = ({
  pipelineName,
  onNameChange,
  status = 'idle',
  onClear,
  onSave,
  onLoad,
  onExportJSON,
}) => {
  const s = STATUS_LABEL[status] ?? STATUS_LABEL.idle;

  return (
    <header className="flex items-center gap-3 px-6 py-3 border-b border-slate-700 bg-slate-900 flex-shrink-0">
      {/* Pipeline name */}
      <input
        className="bg-transparent border-b border-slate-700 text-slate-200 text-sm font-semibold px-1 py-0.5 focus:outline-none focus:border-indigo-500 w-52"
        value={pipelineName}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Untitled Pipeline"
      />

      {/* Status */}
      <span className={`text-[11px] font-mono ml-2 ${s.cls}`}>● {s.text}</span>

      <div className="flex-1" />

      {/* Actions */}
      <button
        onClick={onExportJSON}
        className="px-3 py-1.5 text-xs font-medium bg-transparent border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
        title="Export pipeline as JSON"
      >
        Export JSON
      </button>

      <button
        onClick={onLoad}
        className="px-3 py-1.5 text-xs font-medium bg-transparent border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
      >
        Load
      </button>

      <button
        onClick={onSave}
        className="px-3 py-1.5 text-xs font-medium bg-transparent border border-indigo-700 text-indigo-400 hover:border-indigo-500 hover:text-indigo-200 transition-colors"
      >
        Save
      </button>

      <button
        onClick={onClear}
        className="px-3 py-1.5 text-xs font-medium bg-transparent border border-slate-700 text-slate-600 hover:border-red-700 hover:text-red-400 transition-colors"
        title="Clear canvas"
      >
        Clear
      </button>
    </header>
  );
};

export default MLHeader;
