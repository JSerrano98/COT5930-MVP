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
        <p className="text-[10px] text-echo-muted uppercase tracking-widest mb-1">Model Name</p>
        <input
          className="w-full bg-echo-surface-2 border border-echo-border text-white text-xs px-2 py-1 focus:outline-none focus:border-echo-green"
          placeholder="my_eeg_classifier"
          value={modelName}
          onChange={e => { setModelName(e.target.value); update({ modelName: e.target.value }); }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-echo-muted mb-1">Epochs</p>
          <input type="number" className="w-full bg-echo-surface-2 border border-echo-border text-white text-xs px-1.5 py-1 focus:outline-none focus:border-echo-green"
            value={epochs} onChange={e => { setEpochs(e.target.value); update({ epochs: e.target.value }); }} />
        </div>
        <div>
          <p className="text-[10px] text-echo-muted mb-1">Batch</p>
          <input type="number" className="w-full bg-echo-surface-2 border border-echo-border text-white text-xs px-1.5 py-1 focus:outline-none focus:border-echo-green"
            value={batchSize} onChange={e => { setBatchSize(e.target.value); update({ batchSize: e.target.value }); }} />
        </div>
        <div>
          <p className="text-[10px] text-echo-muted mb-1">LR</p>
          <input type="number" step="0.0001" className="w-full bg-echo-surface-2 border border-echo-border text-white text-xs px-1.5 py-1 focus:outline-none focus:border-echo-green"
            value={lr} onChange={e => { setLr(e.target.value); update({ lr: e.target.value }); }} />
        </div>
      </div>

      <div className="mb-3">
        <p className="text-[10px] text-echo-muted uppercase tracking-widest mb-1">Cross-Validation Folds <span className="normal-case text-echo-dim">(0 = off)</span></p>
        <input type="number" min="0" max="20" className="w-20 bg-echo-surface-2 border border-echo-border text-white text-xs px-2 py-1 focus:outline-none focus:border-echo-green"
          value={cv} onChange={e => { setCv(e.target.value); update({ cv: e.target.value }); }} />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-[11px] text-echo-muted select-none">
          <input type="checkbox" checked={earlyStop} onChange={e => { setEarlyStop(e.target.checked); update({ earlyStop: e.target.checked }); }} className="accent-echo-green" />
          Early Stopping
        </label>
        {earlyStop && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-echo-dim">Patience</span>
            <input type="number" className="w-14 bg-echo-surface-2 border border-echo-border text-white text-xs px-1.5 py-0.5 focus:outline-none focus:border-echo-green"
              value={patience} onChange={e => { setPatience(e.target.value); update({ patience: e.target.value }); }} />
          </div>
        )}
      </div>

      <button
        onClick={() => data?.onTrain?.()}
        disabled={isRunning}
        className={`w-full py-2 text-xs font-bold tracking-wider border transition-colors ${
          isRunning
            ? 'bg-echo-surface-2 border-echo-border text-yellow-400 cursor-wait'
            : isDone
            ? 'bg-echo-surface-2 border-echo-green text-echo-green hover:bg-echo-green/10'
            : 'bg-echo-surface-2 border-echo-border text-white hover:border-echo-green'
        }`}
      >
        {isRunning ? 'Training...' : isDone ? 'Retrain' : 'Train Model'}
      </button>

      {data?.result && (
        <div className="mt-3 pt-2 border-t border-echo-border space-y-1">
          {data.result.progress != null && (
            <div>
              <div className="flex justify-between text-[10px] text-echo-muted mb-0.5">
                <span>Progress</span>
                <span>{data.result.progress}%</span>
              </div>
              <div className="w-full bg-echo-border h-1.5">
                <div className="bg-echo-green h-1.5 transition-all" style={{ width: `${data.result.progress}%` }} />
              </div>
            </div>
          )}
          {data.result.train_acc != null && <p className="text-[10px] text-echo-green font-body">Train acc: {(data.result.train_acc * 100).toFixed(1)}%</p>}
          {data.result.val_acc   != null && <p className="text-[10px] text-echo-blue   font-body">Val acc:   {(data.result.val_acc   * 100).toFixed(1)}%</p>}
          {data.result.model_path && <p className="text-[10px] text-echo-muted font-body truncate">Saved: {data.result.model_path}</p>}
        </div>
      )}
    </MLNodeBase>
  );
};

export default TrainNode;
