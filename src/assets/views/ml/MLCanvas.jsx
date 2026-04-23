import { useCallback, useRef } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge,
  useNodesState, useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import DataLoaderNode from '../../nodes/DataLoaderNode';
import PreprocessNode from '../../nodes/PreprocessNode';
import FeatureNode    from '../../nodes/FeatureNode';
import SplitNode      from '../../nodes/SplitNode';
import ModelNode      from '../../nodes/ModelNode';
import TrainNode      from '../../nodes/TrainNode';
import EvalNode       from '../../nodes/EvalNode';
import EnsembleNode   from '../../nodes/EnsembleNode';

const NODE_TYPES = {
  data_loader:  DataLoaderNode,
  preprocessor: PreprocessNode,
  feature:      FeatureNode,
  split:        SplitNode,
  model:        ModelNode,
  trainer:      TrainNode,
  evaluator:    EvalNode,
  ensemble:     EnsembleNode,
};

// Default size per node type
const NODE_SIZES = {
  data_loader:  { width: 280, height: 220 },
  preprocessor: { width: 280, height: 240 },
  feature:      { width: 300, height: 320 },
  split:        { width: 280, height: 260 },
  model:        { width: 300, height: 360 },
  trainer:      { width: 280, height: 300 },
  evaluator:    { width: 300, height: 280 },
  ensemble:     { width: 300, height: 380 },
};

let _id = 0;
const uid = (type) => `${type}_${++_id}_${Date.now()}`;

/**
 * MLCanvas — ReactFlow canvas for the ML pipeline graph.
 *
 * Props:
 *   nodes / edges / onNodesChange / onEdgesChange — lifted state from MachineLearning
 *   onConnect     — edge connect handler
 *   onNodeConfig  — (id, patch) called when a node's config changes
 *   onTrain       — (id) called when Trainer node fires train
 *   onRemoveNode  — (id)
 *   onDrop        — (nodeType, position) to add a node from the panel
 */
const MLCanvasInner = ({
  nodes, edges,
  onNodesChange, onEdgesChange,
  setNodes, setEdges,
  onNodeConfig,
  onTrain,
  onRemoveNode,
}) => {
  const reactFlowWrapper = useRef(null);
  const rfInstance = useRef(null);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#64748b' } }, eds)),
    [setEdges]
  );

  // Allow drops from the side panel
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/ml-node-type');
    if (!nodeType || !reactFlowWrapper.current) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    // Convert screen coords → flow coords
    const position = rfInstance.current
      ? rfInstance.current.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
      : { x: e.clientX - bounds.left - 140, y: e.clientY - bounds.top - 80 };

    const size = NODE_SIZES[nodeType] ?? { width: 280, height: 240 };
    const id   = uid(nodeType);

    const newNode = {
      id,
      type:     nodeType,
      position,
      style:    { width: size.width, height: size.height },
      data: {
        label:          nodeType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        status:         'idle',
        config:         {},
        onConfigChange: (patch) => onNodeConfig(id, patch),
        onRemove:       () => onRemoveNode(id),
        onTrain:        (nodeType === 'trainer' || nodeType === 'ensemble') ? () => onTrain(id) : undefined,
      },
    };

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, onNodeConfig, onRemoveNode, onTrain, rfInstance]);

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={(instance) => { rfInstance.current = instance; }}        panOnScroll
        panOnDrag={[1, 2]}
        selectionOnDrag={false}
        snapToGrid={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        deleteKeyCode="Delete"
        fitView
      >
        <Background color="#1e293b" gap={20} />
        <Controls className="[&>button]:bg-slate-800 [&>button]:border-slate-700 [&>button]:text-slate-400 [&>button:hover]:bg-slate-700" />
        <MiniMap
          nodeColor={(n) => {
            const colors = { data_loader:'#8b5cf6', preprocessor:'#14b8a6', feature:'#22c55e', split:'#eab308', model:'#f97316', trainer:'#ef4444', evaluator:'#6366f1' };
            return colors[n.type] ?? '#475569';
          }}
          style={{ background: '#0f172a', border: '1px solid #334155' }}
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>
    </div>
  );
};

// Wrap in provider for isolated flow instance
const MLCanvas = (props) => (
  <ReactFlowProvider>
    <MLCanvasInner {...props} />
  </ReactFlowProvider>
);

export default MLCanvas;
