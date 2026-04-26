import { useState } from 'react';
import { Position } from 'reactflow';
import MLNodeBase, { LabeledHandle } from './MLNodeBase';

const MODELS = [
  {
    category: 'Linear',
    options: [
      { key: 'logistic',     label: 'Logistic Regression' },
      { key: 'ridge',        label: 'Ridge Regression' },
      { key: 'lasso',        label: 'Lasso Regression' },
      { key: 'elastic_net',  label: 'Elastic Net' },
      { key: 'linear',       label: 'Linear Regression' },
    ],
  },
  {
    category: 'Classical',
    options: [
      { key: 'svm',            label: 'Support Vector Machine' },
      { key: 'random_forest',  label: 'Random Forest' },
      { key: 'gradient_boost', label: 'Gradient Boosting' },
      { key: 'knn',            label: 'K-Nearest Neighbors' },
      { key: 'lda',            label: 'Linear Discriminant Analysis' },
    ],
  },
  {
    category: 'Neural Network',
    options: [
      { key: 'mlp',    label: 'MLP (Dense)' },
      { key: 'cnn1d',  label: 'CNN 1D' },
      { key: 'lstm',   label: 'LSTM' },
      { key: 'eegnet', label: 'EEGNet' },
    ],
  },
];

const HYPERPARAMS = {
  logistic:      [{ key: 'C', label: 'C', default: 1.0 }, { key: 'max_iter', label: 'Max Iter', default: 1000 }],
  ridge:         [{ key: 'alpha', label: 'Alpha (Î»)', default: 1.0 }],
  linear:        [{ key: 'C', label: 'C', default: 1.0}, {key: 'max_iter', label: 'Max Iter', default: 1000}],
  lasso:         [{ key: 'alpha', label: 'Alpha (Î»)', default: 1.0 }, { key: 'max_iter', label: 'Max Iter', default: 1000 }],
  elastic_net:   [{ key: 'alpha', label: 'Alpha (Î»)', default: 1.0 }, { key: 'l1_ratio', label: 'L1 Ratio', default: 0.5 }],
  svm:           [{ key: 'C', label: 'C', default: 1.0 }, { key: 'kernel', label: 'Kernel', type: 'select', options: ['rbf','linear','poly'], default: 'rbf' }],
  random_forest: [{ key: 'n_estimators', label: 'Trees', default: 100 }, { key: 'max_depth', label: 'Max Depth', default: '' }],
  gradient_boost:[{ key: 'n_estimators', label: 'Estimators', default: 100 }, { key: 'learning_rate', label: 'LR', default: 0.1 }],
  knn:           [{ key: 'n_neighbors', label: 'K', default: 5 }, { key: 'metric', label: 'Metric', type: 'select', options: ['euclidean','manhattan','cosine'], default: 'euclidean' }],
  lda:           [{ key: 'solver', label: 'Solver', type: 'select', options: ['svd','lsqr','eigen'], default: 'svd' }],
  mlp:           [{ key: 'hidden_layers', label: 'Hidden Layers', default: '128,64' }, { key: 'dropout', label: 'Dropout', default: 0.3 }],
  cnn1d:         [{ key: 'filters', label: 'Filters', default: '64,128' }, { key: 'kernel_size', label: 'Kernel', default: 3 }],
  lstm:          [{ key: 'units', label: 'Units', default: 64 }, { key: 'dropout', label: 'Dropout', default: 0.2 }],
  eegnet:        [{ key: 'F1', label: 'F1', default: 8 }, { key: 'D', label: 'D', default: 2 }],
};

const TASKS = ['classification', 'regression'];

const ModelNode = ({ data }) => {
  const cfg = data?.config ?? {};
  const [modelKey, setModelKey] = useState(cfg.model ?? 'svm');
  const [task,     setTask]     = useState(cfg.task  ?? 'classification');
  const [params,   setParams]   = useState(cfg.params ?? {});

  const hpDefs = HYPERPARAMS[modelKey] ?? [];

  const updateParam = (key, val) => {
    const next = { ...params, [key]: val };
    setParams(next);
    data?.onConfigChange?.({ model: modelKey, task, params: next });
  };

  const selectModel = (key) => {
    setModelKey(key);
    const defaults = Object.fromEntries((HYPERPARAMS[key] ?? []).map(h => [h.key, h.default]));
    setParams(defaults);
    data?.onConfigChange?.({ model: key, task, params: defaults });
  };

  return (
    <MLNodeBase
      label={data?.label ?? 'Model'}
      status={data?.status}
      onRemove={data?.onRemove}
      minHeight={200}
      handles={<>
        <LabeledHandle type="target" position={Position.Left}  label="splits in"   top="50%" />
        <LabeledHandle type="source" position={Position.Right} label="config out"  top="50%" />
      </>}
    >
      {/* Task */}
      <div className="flex gap-1 mb-3">
        {TASKS.map(t => (
          <button key={t} onClick={() => { setTask(t); data?.onConfigChange?.({ model: modelKey, task: t, params }); }}
            className={`flex-1 px-2 py-1 text-[10px] font-semibold border transition-colors ${
              task === t ? 'bg-slate-600 border-slate-500 text-slate-100' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Model list */}
      {MODELS.map(({ category, options }) => (
        <div key={category} className="mb-3">
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">{category}</p>
          <div className="flex flex-col gap-0.5">
            {options.map(o => (
              <button key={o.key} onClick={() => selectModel(o.key)}
                className={`w-full text-left px-2 py-1 text-[10px] border transition-colors ${
                  modelKey === o.key ? 'bg-slate-600 border-slate-500 text-slate-100' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Hyperparameters */}
      {hpDefs.length > 0 && (
        <div className="border-t border-slate-700 pt-2 mt-2">
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Hyperparameters</p>
          <div className="grid grid-cols-2 gap-2">
            {hpDefs.map(hp => (
              <div key={hp.key}>
                <p className="text-[10px] text-slate-500 mb-0.5">{hp.label}</p>
                {hp.type === 'select' ? (
                  <select
                    value={params[hp.key] ?? hp.default}
                    onChange={e => updateParam(hp.key, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-1 py-0.5 focus:outline-none focus:border-slate-500"
                  >
                    {hp.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-1.5 py-0.5 focus:outline-none focus:border-slate-500"
                    value={params[hp.key] ?? hp.default}
                    onChange={e => updateParam(hp.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </MLNodeBase>
  );
};

export default ModelNode;
