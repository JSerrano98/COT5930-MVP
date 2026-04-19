import { useState, useMemo, useRef, useEffect } from 'react';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import Monitor from './monitor/Monitor';
import WaveformNode from './monitor/WaveformNode';
import StatsNode from './monitor/StatsNode';

// Standard RGL config — rowHeight=20, cols=12, default card 4×9
// Pixel height = h*rowHeight + (h-1)*marginY = 9*20 + 8*4 = 212px
const ROW_H  = 20;
const COLS   = 12;
const CARD_W = 4;
const CARD_H = 2;   // ~212px tall on open

const makeItem = (mon, idx) => ({
  i: mon.id,
  x: (idx % 3) * CARD_W,
  y: Math.floor(idx / 3) * CARD_H,
  w: CARD_W,
  h: CARD_H,
});

const NodeBody = ({ stream, nodeType, dataRef, lineColor }) => {
  if (!stream) return null;
  if (nodeType === 'waveform') return <WaveformNode stream={stream} dataRef={dataRef} lineColor={lineColor} />;
  if (nodeType === 'stats')    return <StatsNode    stream={stream} dataRef={dataRef} />;
  return (
    <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
      No renderer for <span className="ml-1 text-slate-400">{nodeType}</span>
    </div>
  );
};

const DashboardGrid = ({ monitors = [], dataRef, onRemove, onUpdateMonitor, sessionRunning }) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  // Only store user-initiated drag/resize overrides — NOT auto-computed positions.
  // This prevents RGL's internal compaction from corrupting default sizes.
  const [overrides, setOverrides] = useState({});

  const layout = useMemo(() =>
    monitors.map((mon, idx) => overrides[mon.id] ?? makeItem(mon, idx)),
    [monitors, overrides]
  );

  const onDragStop   = (_l, _o, item) => setOverrides(p => ({ ...p, [item.i]: item }));
  const onResizeStop = (_l, _o, item) => setOverrides(p => ({ ...p, [item.i]: item }));

  if (monitors.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600 text-sm font-mono select-none bg-slate-950">
        {sessionRunning ? 'Select a stream in the panel to add a node' : 'Start a session to begin'}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 min-w-0 overflow-auto bg-slate-950">
      <style>{`
        .react-resizable-handle {
          position: absolute; width: 16px; height: 16px;
          bottom: 0; right: 0; cursor: se-resize;
        }
        .react-resizable-handle::after {
          content: ''; position: absolute;
          right: 4px; bottom: 4px; width: 6px; height: 6px;
          border-right: 2px solid #475569; border-bottom: 2px solid #475569;
        }
        .react-grid-item.react-grid-placeholder { background: #1e293b; opacity: 0.4; }
      `}</style>

      <ReactGridLayout
        width={containerWidth}
        layout={layout}
        onDragStop={onDragStop}
        onResizeStop={onResizeStop}
        cols={COLS}
        rowHeight={ROW_H}
        draggableHandle=".monitor-drag"
        compactType={null}
        preventCollision={false}
        margin={[6, 6]}
        containerPadding={[8, 8]}
        useCSSTransforms
      >
        {monitors.map(mon => (
          <div key={mon.id} style={{ height: '100%' }}>
            <Monitor
              stream={mon.stream}
              nodeType={mon.nodeType}
              lineColor={mon.lineColor}
              onColorChange={c => onUpdateMonitor(mon.id, { lineColor: c })}
              onRemove={() => onRemove(mon.id)}
            >
              <NodeBody
                stream={mon.stream}
                nodeType={mon.nodeType}
                dataRef={dataRef}
                lineColor={mon.lineColor}
              />
            </Monitor>
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
};

export default DashboardGrid;
