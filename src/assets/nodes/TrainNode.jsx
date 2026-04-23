import { useState } from 'react';
import { Position } from 'reactflow';
import MLNodeBase, { LabeledHandle } from './MLNodeBase';

const TrainNode = ({ data }) => {
  const cfg  = data?.config ?? {};
  const [epochs,     setEpochs]     = useState(cfg.epochs     ?? 50);
  const [batchSize,  setBatchSize]  = useState(cfg.batchSize  ?? 32);
  const [lr,         setLr]         = useState(cfg.lr         ?? 0.001);
  const [cv,         setCv]         = useState(cfg.cv         ?? 0);
  const [earlyStop,  setEarlyStop]  = useState(cfg.earlyStop  ?? true);
  const [patience,   setPatience]   = useState(cfg.patience   ?? 10);
  const [modelName,  setModelName]  = useState(cfg.modelName  ?? '');

  const update = (patch) => {
    data?.onConfigChange?.({ epochs, batchSize, lr, cv, earlyStop, patience, modelName, ...patch });
  };

  const isRunning = data?.status === 'running';
  const isDone    = data?.status === 'done';

  return (
    <MLNodeBase
      label={data?.label ?? 'Trainer'}
      status={data?.status}
      onRemove={data?.onRemove}
      handles={<>
        <LabeledHandle type="target" position={Position.Left}  label="model in"    top="50%" />
        <LabeledHandle type="source" position={Position.Right} label="trained out" top="50%" />
      </>}
    >
      <div className="mb-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Model Name</p>
        <input
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 focus:outline-none focus:border-slate-500"
          placeholder="my_eeg_classifier"
          value={modelName}
          onChange={e => { setModelName(e.target.value); update({ modelName: e.target.value }); }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-slate-500 mb-1">Epochs</p>
          <input type="number" className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-1.5 py-1 focus:outline-none focus:border-slate-500"
            value={epochs} onChange={e => { setEpochs(e.target.value); update({ epochs: e.target.value }); }} />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 mb-1">Batch</p>
          <input type="number" className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-1.5 py-1 focus:outline-none focus:border-slate-500"
            value={batchSize} onChange={e => { setBatchSize(e.target.value); update({ batchSize: e.target.value }); }} />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 mb-1">LR</p>
          <input type="number" step="0.0001" className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs px-1.5 py-1 focus:outline-none focus:border-slate-500"
            value={lr} onChange={e => { setLr(e.target.value); update({ lr: e.target.value }); }} />
        </div>
      </div>

      <div className="mb-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Cross-Validation Folds <span className="normal-case text-slate-600">(0 = off)</span></p>
        <input type="number" min="0" max="20" className="w-20 bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 focus:outline-none focus:border-slate-500"
          value={cv} onChange={e => { setCv(e.target.value); update({ cv: e.target.value }); }} />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-400 select-none">
          <input type="checkbox" checked={earlyStop} onChange={e => { setEarlyStop(e.target.checked); update({ earlyStop: e.target.checked }); }} className="accent-slate-400" />
          Early Stopping
        </label>
        {earlyStop && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Patience</span>
            <input type="number" className="w-14 bg-slate-800 border border-slate-700 text-slate-200 text-xs px-1.5 py-0.5 focus:outline-none focus:border-slate-500"
              value={patience} onChange={e => { setPatience(e.target.value); update({ patience: e.target.value }); }} />
          </div>
        )}
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
        {isRunning ? 'â³ Trainingâ€¦' : isDone ? 'âœ“ Retrain' : 'â–¶  Train Model'}
      </button>

      {data?.result && (
        <div className="mt-3 pt-2 border-t border-slate-700 space-y-1">
          {data.result.progress != null && (
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                <span>Progress</span>
                <span>{data.result.progress}%</span>
              </div>
              <div className="w-full bg-slate-700 h-1.5">
                <div className="bg-slate-400 h-1.5 transition-all" style={{ width: `${data.result.progress}%` }} />
              </div>
            </div>
          )}
          {data.result.train_acc != null && <p className="text-[10px] text-emerald-400 font-mono">Train acc: {(data.result.train_acc * 100).toFixed(1)}%</p>}
          {data.result.val_acc   != null && <p className="text-[10px] text-blue-400   font-mono">Val acc:   {(data.result.val_acc   * 100).toFixed(1)}%</p>}
          {data.result.model_path && <p className="text-[10px] text-slate-400 font-mono truncate">Saved: {data.result.model_path}</p>}
        </div>
      )}
    </MLNodeBase>
  );
};

export default TrainNode;
