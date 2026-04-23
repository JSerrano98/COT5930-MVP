import { useState } from 'react';
import { Position } from 'reactflow';
import MLNodeBase, { LabeledHandle } from './MLNodeBase';

const META_LEARNERS = [
  { key: 'logistic',  label: 'Logistic Regression' },
  { key: 'mlp',       label: 'MLP (Neural Net)' },
  { key: 'ridge',     label: 'Ridge Regression' },
  { key: 'gradient_boost', label: 'Gradient Boosting' },
];

const EnsembleNode = ({ data }) => {
  const cfg = data?.config ?? {};
  const [metaLearner, setMetaLearner] = useState(cfg.metaLearner  ?? 'mlp');
  const [cvFolds,     setCvFolds]     = useState(cfg.cvFolds      ?? 5);
  const [useProba,    setUseProba]    = useState(cfg.useProba      ?? true);
  const [modelName,   setModelName]   = useState(cfg.modelName     ?? '');

  const update = (patch) => {
    data?.onConfigChange?.({ metaLearner, cvFolds, useProba, modelName, ...patch });
  };

  const isRunning = data?.status === 'running';
  const isDone    = data?.status === 'done';

  return (
    <MLNodeBase
      label={data?.label ?? 'Ensemble (Stacking)'}
      status={data?.status}
      onRemove={data?.onRemove}
      minHeight={220}
      handles={<>
        {/* Multiple trainer outputs can connect to this single handle */}
        <LabeledHandle type="target" position={Position.Left}  label="models in"    top="50%" />
        <LabeledHandle type="source" position={Position.Right} label="stacked out"  top="50%" />
      </>}
    >
      <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
        Connect multiple Trainer nodes to the left handle. Their out-of-fold predictions
        will be stacked as features for the meta-learner.
      </p>

      <div className="mb-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Model Name</p>
        <input
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 focus:outline-none focus:border-slate-500"
          placeholder="ensemble_model"
          value={modelName}
          onChange={e => { setModelName(e.target.value); update({ modelName: e.target.value }); }}
        />
      </div>

      <div className="mb-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Meta-Learner</p>
        <div className="flex flex-col gap-0.5">
          {META_LEARNERS.map(ml => (
            <button key={ml.key} onClick={() => { setMetaLearner(ml.key); update({ metaLearner: ml.key }); }}
              className={`w-full text-left px-2 py-1 text-[10px] border transition-colors ${
                metaLearner === ml.key ? 'bg-slate-600 border-slate-500 text-slate-100' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}>
              {ml.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-3">
        <div>
          <p className="text-[10px] text-slate-500 mb-1">OOF Folds</p>
          <input type="number" min="2" max="20"
            className="w-20 bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 focus:outline-none focus:border-slate-500"
            value={cvFolds}
            onChange={e => { setCvFolds(e.target.value); update({ cvFolds: e.target.value }); }}
          />
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-400 select-none mt-4">
          <input type="checkbox" checked={useProba} onChange={e => { setUseProba(e.target.checked); update({ useProba: e.target.checked }); }} className="accent-slate-400" />
          Use predict_proba
        </label>
      </div>

      <button
        onClick={() => data?.onTrain?.()}
        disabled={isRunning}
        className={`w-full py-2 text-xs font-bold tracking-wider border transition-colors ${
          isRunning
            ? 'bg-slate-800 border-slate-600 text-yellow-400 cursor-wait'
            : isDone
            ? 'bg-slate-800 border-slate-600 text-emerald-400 hover:bg-slate-700'
            : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
        }`}
      >
        {isRunning ? '⏳ Stacking…' : isDone ? '✓ Retrain Ensemble' : '▶  Train Ensemble'}
      </button>

      {data?.result && (
        <div className="mt-3 pt-2 border-t border-slate-700 space-y-1">
          {data.result.base_model_count != null && (
            <p className="text-[10px] text-slate-400 font-mono">Base models: {data.result.base_model_count}</p>
          )}
          {data.result.accuracy != null && (
            <p className="text-[10px] text-emerald-400 font-mono">Stacked acc: {(data.result.accuracy * 100).toFixed(1)}%</p>
          )}
          {data.result.model_path && (
            <p className="text-[10px] text-slate-400 font-mono truncate">Saved: {data.result.model_path}</p>
          )}
        </div>
      )}
    </MLNodeBase>
  );
};

export default EnsembleNode;
