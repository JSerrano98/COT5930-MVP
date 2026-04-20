import React, { useCallback, useEffect } from 'react';
import ReactFlow, { Background, Controls, addEdge, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import Monitor from './monitor/Monitor';
import WaveformNode from './monitor/WaveformNode';
import StatsNode from './monitor/StatsNode';

// Each node wraps its content in Monitor to get the header + container
const WaveformFlowNode = ({ data }) => (
  <Monitor stream={data.stream} nodeType="waveform" lineColor={data.lineColor} onColorChange={data.onColorChange} onRemove={data.onRemove} dataRef={data.dataRef}>
    <WaveformNode stream={data.stream} dataRef={data.dataRef} lineColor={data.lineColor} />
  </Monitor>
);

const StatsFlowNode = ({ data }) => (
  <Monitor stream={data.stream} nodeType="stats" onRemove={data.onRemove} dataRef={data.dataRef}>
    <StatsNode stream={data.stream} dataRef={data.dataRef} />
  </Monitor>
);

const nodeTypes = {
  waveform: WaveformFlowNode,
  stats:    StatsFlowNode,
};

const DEFAULT_W = 340;
const DEFAULT_H = 220;

function DashboardCanvas({ monitors = [], dataRef, onRemove, onUpdateMonitor }) {
  const makeNode = (mon, idx, posMap = {}, sizeMap = {}) => ({
    id: mon.id,
    type: mon.nodeType,
    position: posMap[mon.id] ?? { x: 80 + (idx % 3) * (DEFAULT_W + 20), y: 80 + Math.floor(idx / 3) * (DEFAULT_H + 20) },
    data: {
      stream: mon.stream,
      dataRef,
      lineColor: mon.lineColor,
      onColorChange: c => onUpdateMonitor(mon.id, { lineColor: c }),
      onRemove: () => onRemove(mon.id),
    },
    style: sizeMap[mon.id] ?? { width: DEFAULT_W, height: DEFAULT_H },
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(monitors.map((m, i) => makeNode(m, i)));
  const [edges, setEdges, onEdgesState] = useEdgesState([]);

  // Sync monitors → nodes, preserving positions/sizes of existing nodes
  useEffect(() => {
    setNodes(prev => {
      const posMap = Object.fromEntries(prev.map(n => [n.id, n.position]));
      const sizeMap = Object.fromEntries(prev.map(n => [n.id, n.style]));
      return monitors.map((mon, idx) => makeNode(mon, idx, posMap, sizeMap));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitors]);

  const onConnect = useCallback((params) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#c9cdd4' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesState}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        panOnScroll
        panOnDrag={[1, 2]}
        selectionOnDrag={false}
        snapToGrid={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.25}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="#1e293b" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default DashboardCanvas;
