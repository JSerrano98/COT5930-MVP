import React, { useCallback, useEffect, useRef } from 'react';
import ReactFlow, { Background, Controls, addEdge, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import Monitor from './monitor/Monitor';
import WaveformNode from './monitor/WaveformNode';
import StatsNode from './monitor/StatsNode';
import BPMNode from './monitor/BPMNode';
import MLModelNode from './monitor/MLModelNode';
import CSVReplayNode from './monitor/CSVReplayNode';
import EDANode from './monitor/EDANode';
import EMGNode from './monitor/EMGNode';
import RespirationNode from './monitor/RespirationNode';
import TemperatureNode from './monitor/TemperatureNode';

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

const EDAFlowNode = ({ data }) => (
  <Monitor stream={data.stream} nodeType="eda" onRemove={data.onRemove} dataRef={data.dataRef}>
    <EDANode stream={data.stream} dataRef={data.dataRef} />
  </Monitor>
);

const EMGFlowNode = ({ data }) => (
  <Monitor stream={data.stream} nodeType="emg" onRemove={data.onRemove} dataRef={data.dataRef}>
    <EMGNode stream={data.stream} dataRef={data.dataRef} />
  </Monitor>
);

const RespFlowNode = ({ data }) => (
  <Monitor stream={data.stream} nodeType="resp" onRemove={data.onRemove} dataRef={data.dataRef}>
    <RespirationNode stream={data.stream} dataRef={data.dataRef} />
  </Monitor>
);

const TempFlowNode = ({ data }) => (
  <Monitor stream={data.stream} nodeType="temp" onRemove={data.onRemove} dataRef={data.dataRef}>
    <TemperatureNode stream={data.stream} dataRef={data.dataRef} />
  </Monitor>
);

const MLFlowNode = ({ data }) => {
  const modelName = data.monitor?.sensorName || null;
  const displayStream = data.stream || (modelName ? { name: modelName } : null);
  return (
    <Monitor stream={displayStream} nodeType="ml" onRemove={data.onRemove} dataRef={data.dataRef}>
      <MLModelNode monitor={data.monitor} streams={data.streams} dataRef={data.dataRef} onPatch={data.onPatch} />
    </Monitor>
  );
};

const CSVReplayFlowNode = ({ data }) => (
  <Monitor stream={data.stream} nodeType="csvReplay" onRemove={data.onRemove} dataRef={data.dataRef}>
    <CSVReplayNode
      monitor={data.monitor}
      dataRef={data.dataRef}
      onPatch={data.onPatch}
      onRecordingChange={data.onRecordingChange}
    />
  </Monitor>
);

const nodeTypes = {
  waveform: WaveformFlowNode,
  stats:    StatsFlowNode,
  bpm:      BPMFlowNode,
  eda:      EDAFlowNode,
  emg:      EMGFlowNode,
  resp:     RespFlowNode,
  temp:     TempFlowNode,
  ml:       MLFlowNode,
  csvReplay: CSVReplayFlowNode,
};

const DEFAULT_W = 340;
const DEFAULT_H = 220;

const NODE_DEFAULTS = {
  bpm: { width: 220, height: 200 },
  eda: { width: 320, height: 250 },
  emg: { width: 320, height: 250 },
  resp: { width: 320, height: 260 },
  temp: { width: 320, height: 240 },
  ml: { width: 360, height: 320 },
  csvReplay: { width: 360, height: 320 },
};

function DashboardCanvas({ monitors = [], streams = [], dataRef, onRemove, onUpdateMonitor, onRecordingChange }) {
  const streamsRef = useRef(streams);

  const makeNode = useCallback((mon, idx, posMap = {}, sizeMap = {}) => {
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
        streams: mon.nodeType === 'ml' ? streamsRef.current : undefined,
        dataRef,
        lineColor: mon.lineColor,
        onColorChange: c => onUpdateMonitor(mon.id, { lineColor: c }),
        onPatch: (patch) => onUpdateMonitor(mon.id, patch),
        onRecordingChange,
        onRemove: () => onRemove(mon.id),
      },
      style: sizeMap[mon.id] ?? defaultSize,
    };
  }, [dataRef, onUpdateMonitor, onRecordingChange, onRemove]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesState] = useEdgesState([]);

  useEffect(() => {
    setNodes(prev => {
      const posMap = Object.fromEntries(prev.map(n => [n.id, n.position]));
      const sizeMap = Object.fromEntries(prev.map(n => [n.id, n.style]));
      return monitors.map((mon, idx) => makeNode(mon, idx, posMap, sizeMap));
    });
  }, [monitors, makeNode, setNodes]);

  useEffect(() => {
    streamsRef.current = streams;
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type !== 'ml') return n;
        if (n.data?.streams === streams) return n;
        return { ...n, data: { ...n.data, streams } };
      }),
    );
  }, [streams, setNodes]);

  const onConnect = useCallback((params) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#E8ECF0' }}>
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
        <Background variant="dots" color="#8A9DB5" gap={24} size={1.5} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default DashboardCanvas;