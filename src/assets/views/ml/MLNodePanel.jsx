/**
 * MLNodePanel — left sidebar listing all available ML node types.
 * Nodes can be dragged onto the canvas.
 */

const CATEGORIES = [
  {
    label: 'Data',
    nodes: [
      { type: 'data_loader', label: 'Data Loader',         desc: 'Load CSV or recorded session',   color: 'border-l-violet-500' },
    ],
  },
  {
    label: 'Processing',
    nodes: [
      { type: 'preprocessor', label: 'Preprocessor',       desc: 'Scale, filter, clean data',       color: 'border-l-teal-500' },
      { type: 'feature',      label: 'Feature Engineering', desc: 'Extract time/freq features',     color: 'border-l-green-500' },
    ],
  },
  {
    label: 'Pipeline',
    nodes: [
      { type: 'split',    label: 'Train/Test Split', desc: 'Split dataset for evaluation',    color: 'border-l-yellow-500' },
      { type: 'model',    label: 'Model',            desc: 'Select algorithm & hyperparams',  color: 'border-l-orange-500' },
      { type: 'trainer',  label: 'Trainer',          desc: 'Configure & run training',        color: 'border-l-red-500' },
      { type: 'evaluator',label: 'Evaluator',        desc: 'Metrics, confusion matrix',       color: 'border-l-indigo-500' },
    ],
  },
  {
    label: 'Ensemble',
    nodes: [
      { type: 'ensemble', label: 'Ensemble (Stacking)', desc: 'Stack N models → meta-learner', color: 'border-l-cyan-500' },
    ],
  },
];

const DraggableNode = ({ type, label, desc, color }) => {
  const onDragStart = (e) => {
    e.dataTransfer.setData('application/ml-node-type', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-slate-800 border border-slate-700 border-l-2 ${color} px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-slate-750 hover:border-slate-600 transition-colors select-none`}
    >
      <p className="text-[11px] font-semibold text-slate-200">{label}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
    </div>
  );
};

const MLNodePanel = ({ collapsed = false, onToggle }) => (
  <aside className={`flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? 'w-8' : 'w-56'}`}>
    {/* Header */}
    <div className="flex items-center justify-between px-2 py-3 border-b border-slate-700 flex-shrink-0">
      {!collapsed && (
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">Nodes</span>
      )}
      <button
        onClick={onToggle}
        className="ml-auto text-slate-500 hover:text-slate-200 transition-colors p-1 leading-none"
        title={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {collapsed ? '›' : '‹'}
      </button>
    </div>

    {!collapsed && (
      <div className="flex-1 overflow-y-auto py-2">
        <p className="px-4 pb-2 text-[9px] text-slate-600 font-mono">Drag nodes onto the canvas</p>

        {CATEGORIES.map(({ label, nodes }) => (
          <div key={label} className="mb-4">
            <div className="px-4 py-1 bg-slate-800 border-y border-slate-700">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {nodes.map(n => (
                <DraggableNode key={n.type} {...n} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
  </aside>
);

export default MLNodePanel;
