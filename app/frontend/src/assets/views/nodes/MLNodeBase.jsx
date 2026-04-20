import { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizeControl } from 'reactflow';

const STATUS_STYLES = {
  idle:    { dot: 'bg-slate-600',                label: 'Idle' },
  ready:   { dot: 'bg-blue-400',                 label: 'Ready' },
  running: { dot: 'bg-yellow-400 animate-pulse', label: 'Running' },
  done:    { dot: 'bg-emerald-400',              label: 'Done' },
  error:   { dot: 'bg-red-500',                  label: 'Error' },
};

/**
 * LabeledHandle — ReactFlow handle with an adjacent text label inside the node boundary.
 * Render these as direct children of MLNodeBase (via the `handles` prop) so they
 * sit outside the overflow:auto body div and are never clipped.
 *
 * position : Position.Left (input) | Position.Right (output)
 * top      : CSS string e.g. '50%', '35%'
 */
export const LabeledHandle = ({ type, position, id, label, top = '50%' }) => {
  const isLeft = position === Position.Left;
  const isTarget = type === 'target';
  return (
    <>
      <Handle
        type={type}
        position={position}
        id={id}
        style={{
          top,
          background: '#475569',
          width: 10,
          height: 10,
          border: '2px solid #1e293b',
          borderRadius: isTarget ? '50%' : 2,
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: `calc(${top} - 5px)`,
          // Outside the node: right-align against left edge, or left-align against right edge
          ...(isLeft
            ? { right: '100%', paddingRight: 8, textAlign: 'right' }
            : { left: '100%',  paddingLeft: 8,  textAlign: 'left'  }),
          fontSize: 9,
          color: '#94a3b8',
          pointerEvents: 'none',
          userSelect: 'none',
          fontFamily: 'monospace',
          lineHeight: '10px',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </>
  );
};

/**
 * MLNodeBase — uniform dark container for all ML pipeline nodes.
 *
 * Props:
 *   handles   : ReactNode — LabeledHandle elements rendered as direct children
 *               of the root div (outside the overflow body). Pass handles here
 *               to avoid clipping issues.
 */
const MLNodeBase = ({
  label,
  status = 'idle',
  onRemove,
  handles,
  children,
  minWidth = 260,
  minHeight = 120,
  resizable = true,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.idle;

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700 w-full h-full relative">
      {/* Handles live here — direct children of the relative root, not inside overflow:auto */}
      {handles}

      {/* Header / drag handle */}
      <div className="ml-node-drag flex items-center gap-2 px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0 cursor-grab active:cursor-grabbing select-none">
        <svg className="w-3 h-3 text-slate-600 flex-shrink-0" fill="currentColor" viewBox="0 0 8 12">
          <circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/>
          <circle cx="2" cy="6" r="1"/><circle cx="6" cy="6" r="1"/>
          <circle cx="2" cy="10" r="1"/><circle cx="6" cy="10" r="1"/>
        </svg>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} title={s.label} />
        <span className="text-[11px] font-semibold text-slate-200 tracking-wide truncate flex-1">{label}</span>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-slate-500 hover:text-slate-200 transition-colors px-1 leading-none text-xs"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▼' : '▲'}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-slate-600 hover:text-red-400 transition-colors px-1 leading-none text-xs ml-1"
            title="Remove node"
          >
            ✕
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="flex-1 overflow-auto p-3 min-h-0">
          {children}
        </div>
      )}

      {/* Resize grip */}
      {resizable && (
        <NodeResizeControl
          minWidth={minWidth}
          minHeight={collapsed ? 44 : minHeight}
          style={{ background: 'transparent', border: 'none' }}
        >
          <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize">
            <svg viewBox="0 0 6 6" fill="none" className="w-full h-full text-slate-600">
              <path d="M6 0L6 6L0 6" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        </NodeResizeControl>
      )}
    </div>
  );
};

export default MLNodeBase;
