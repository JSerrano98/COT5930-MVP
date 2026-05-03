import { Position } from 'reactflow';
import MLNodeBase, { LabeledHandle } from './MLNodeBase';

const BAR_COLOR = (v) => {
  if (v >= 0.9) return 'bg-echo-green';
  if (v >= 0.7) return 'bg-echo-blue';
  if (v >= 0.5) return 'bg-yellow-500';
  return 'bg-red-500';
};

const MetricBar = ({ label, value }) => (
  <div className="mb-2">
    <div className="flex justify-between text-[10px] mb-0.5">
      <span className="text-echo-muted">{label}</span>
      <span className="text-white font-body">{(value * 100).toFixed(1)}%</span>
    </div>
    <div className="w-full bg-echo-border h-1.5">
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
        <p className="text-[11px] text-echo-dim text-center py-4">Connect a Trainer node and run the pipeline to see results.</p>
      )}

      {r && (
        <>
          {r.accuracy   != null && <MetricBar label="Accuracy"  value={r.accuracy}  />}
          {r.precision  != null && <MetricBar label="Precision" value={r.precision} />}
          {r.recall     != null && <MetricBar label="Recall"    value={r.recall}    />}
          {r.f1         != null && <MetricBar label="F1 Score"  value={r.f1}        />}
          {r.auc        != null && <MetricBar label="AUC-ROC"   value={r.auc}       />}

          {r.confusion_matrix && (
            <div className="mt-3 border-t border-echo-border pt-2">
              <p className="text-[10px] text-echo-muted uppercase tracking-widest mb-2">Confusion Matrix</p>
              <div className="overflow-x-auto">
                <table className="text-[10px] font-mono text-echo-muted">
                  <tbody>
                    {r.confusion_matrix.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-0.5 text-center border border-echo-border min-w-7">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {r.classification_report && (
            <div className="mt-3 border-t border-echo-border pt-2">
              <p className="text-[10px] text-echo-muted uppercase tracking-widest mb-1">Class Report</p>
              <pre className="text-[9px] text-echo-muted font-mono overflow-x-auto">{r.classification_report}</pre>
            </div>
          )}
        </>
      )}
    </MLNodeBase>
  );
};

export default EvalNode;
