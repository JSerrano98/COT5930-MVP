import { Position } from 'reactflow';
import MLNodeBase, { LabeledHandle } from './MLNodeBase';

const BAR_COLOR = (v) => {
  if (v >= 0.9) return 'bg-emerald-500';
  if (v >= 0.7) return 'bg-blue-500';
  if (v >= 0.5) return 'bg-yellow-500';
  return 'bg-red-500';
};

const MetricBar = ({ label, value }) => (
  <div className="mb-2">
    <div className="flex justify-between text-[10px] mb-0.5">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-mono">{(value * 100).toFixed(1)}%</span>
    </div>
    <div className="w-full bg-slate-700 h-1.5">
      <div className={`h-1.5 transition-all ${BAR_COLOR(value)}`} style={{ width: `${value * 100}%` }} />
    </div>
  </div>
);

const EvalNode = ({ data }) => {
  const r = data?.result ?? null;

  return (
    <MLNodeBase
      label={data?.label ?? 'Evaluator'}
      status={data?.status}
      onRemove={data?.onRemove}
      handles={
        <LabeledHandle type="target" position={Position.Left} label="trained in" top="50%" />
      }
    >
      {!r && (
        <p className="text-[11px] text-slate-600 text-center py-4">Connect a Trainer node and run the pipeline to see results.</p>
      )}

      {r && (
        <>
          {r.accuracy   != null && <MetricBar label="Accuracy"  value={r.accuracy}  />}
          {r.precision  != null && <MetricBar label="Precision" value={r.precision} />}
          {r.recall     != null && <MetricBar label="Recall"    value={r.recall}    />}
          {r.f1         != null && <MetricBar label="F1 Score"  value={r.f1}        />}
          {r.auc        != null && <MetricBar label="AUC-ROC"   value={r.auc}       />}

          {r.confusion_matrix && (
            <div className="mt-3 border-t border-slate-700 pt-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Confusion Matrix</p>
              <div className="overflow-x-auto">
                <table className="text-[10px] font-mono text-slate-300">
                  <tbody>
                    {r.confusion_matrix.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-0.5 text-center border border-slate-700 min-w-[28px]">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {r.classification_report && (
            <div className="mt-3 border-t border-slate-700 pt-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Class Report</p>
              <pre className="text-[9px] text-slate-400 font-mono overflow-x-auto">{r.classification_report}</pre>
            </div>
          )}
        </>
      )}
    </MLNodeBase>
  );
};

export default EvalNode;
