import React, { useCallback, useEffect } from 'react';
import ReactFlow, { Background, Controls, addEdge, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import Monitor from './monitor/Monitor';
import WaveformNode from './monitor/WaveformNode';
import StatsNode from './monitor/StatsNode';
import BPMNode from './monitor/BPMNode';
import MLModelNode from './monitor/MLModelNode';

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

const BPMFlowNode = ({ data }) => (
  <Monitor stream={data.stream} nodeType="bpm" onRemove={data.onRemove} dataRef={data.dataRef}>
    <BPMNode stream={data.stream} dataRef={data.dataRef} />
  </Monitor>
);

const MLFlowNode = ({ data }) => (
  <Monitor stream={data.stream} nodeType="ml" onRemove={data.onRemove} dataRef={data.dataRef}>
    <MLModelNode monitor={data.monitor} streams={data.streams} dataRef={data.dataRef} onPatch={data.onPatch} />
  </Monitor>
);

const nodeTypes = {
  waveform: WaveformFlowNode,
  stats:    StatsFlowNode,
  bpm:      BPMFlowNode,
  ml:       MLFlowNode,
};

const DEFAULT_W = 340;
const DEFAULT_H = 220;

const NODE_DEFAULTS = {
  bpm: { width: 220, height: 200 },
  ml: { width: 320, height: 260 },
};

function DashboardCanvas({ monitors = [], streams = [], dataRef, onRemove, onUpdateMonitor }) {
  const makeNode = (mon, idx, posMap = {}, sizeMap = {}) => {
    const defaultSize = NODE_DEFAULTS[mon.nodeType]
      ? { width: NODE_DEFAULTS[mon.nodeType].width, height: NODE_DEFAULTS[mon.nodeType].height }
      : { width: DEFAULT_W, height: DEFAULT_H };
    return {
      id: mon.id,
      type: mon.nodeType,
      position: posMap[mon.id] ?? { x: 80 + (idx % 3) * (DEFAULT_W + 20), y: 80 + Math.floor(idx / 3) * (DEFAULT_H + 20) },
      data: {
        stream: mon.stream,
        monitor: mon,
        streams,
        dataRef,
        lineColor: mon.lineColor,
        onColorChange: c => onUpdateMonitor(mon.id, { lineColor: c }),
        onPatch: (patch) => onUpdateMonitor(mon.id, patch),
        onRemove: () => onRemove(mon.id),
      },
      style: sizeMap[mon.id] ?? defaultSize,
    };
  };

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
