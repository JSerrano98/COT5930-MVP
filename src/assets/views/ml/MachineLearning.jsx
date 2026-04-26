import { useState, useCallback, useRef } from 'react';
import { useNodesState, useEdgesState } from 'reactflow';
import MLHeader    from './MLHeader';
import MLNodePanel from './MLNodePanel';
import MLCanvas    from './MLCanvas';

const BACKEND = 'http://localhost:8000';

/**
 * Serialize the current ReactFlow graph into the pipeline JSON format
 * the backend expects.
 */
const serializePipeline = (name, nodes, edges) => ({
  name,
  nodes: nodes.map(n => ({
    id:       n.id,
    type:     n.type,
    position: n.position,
    config:   n.data?.config ?? {},
    label:    n.data?.label  ?? n.type,
  })),
  edges: edges.map(e => ({
    id:       e.id,
    source:   e.source,
    target:   e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  })),
});

const MachineLearning = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [pipelineName, setPipelineName]  = useState('Untitled Pipeline');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState('idle');

  // Track per-node config patches outside of ReactFlow state
  // (avoids stale closure issues when nodes mutate rapidly)
  const configsRef = useRef({});

  // ── Node config updates ────────────────────────────────────────────
  const handleNodeConfig = useCallback((id, patch) => {
    configsRef.current[id] = { ...(configsRef.current[id] ?? {}), ...patch };
    setNodes(nds =>
      nds.map(n =>
        n.id === id ? { ...n, data: { ...n.data, config: configsRef.current[id] } } : n
      )
    );
  }, [setNodes]);

  // ── Remove node ────────────────────────────────────────────────────
  const handleRemoveNode = useCallback((id) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    delete configsRef.current[id];
  }, [setNodes, setEdges]);

  // ── Update node status / result ────────────────────────────────────
  const patchNode = useCallback((id, patch) => {
    setNodes(nds =>
      nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)
    );
  }, [setNodes]);

  // ── Train (single trainer node) ────────────────────────────────────
  const handleTrain = useCallback(async (trainerId) => {
    const snapshot = nodes.map(n => ({
      ...n,
      data: { ...n.data, config: configsRef.current[n.id] ?? n.data?.config ?? {} },
    }));

    const pipeline = serializePipeline(pipelineName, snapshot, edges);
    pipeline.train_node_id = trainerId;

    patchNode(trainerId, { status: 'running', result: { progress: 0 } });
    setPipelineStatus('running');
    console.log(JSON.stringify(pipeline))

    try {
      const res = await fetch(`${BACKEND}/ml/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipeline),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? 'Training failed');
      }

      const data = await res.json();
      console.log(data)

      (data.node_results ?? []).forEach(({ id, result }) => {
        patchNode(id, { status: 'done', result });
      });

      patchNode(trainerId, { status: 'done', result: data.trainer_result ?? {} });
      setPipelineStatus('done');
    } catch (err) {
      patchNode(trainerId, { status: 'error', result: { error: err.message } });
      setPipelineStatus('error');
      console.error('[ML] Training error:', err);
    }
  }, [nodes, edges, pipelineName, patchNode]);

  // ── Save pipeline ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const snapshot = nodes.map(n => ({
      ...n,
      data: { ...n.data, config: configsRef.current[n.id] ?? n.data?.config ?? {} },
    }));
    const pipeline = serializePipeline(pipelineName, snapshot, edges);

    try {
      const res = await fetch(`${BACKEND}/ml/pipeline/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipeline),
      });
      if (!res.ok) throw new Error(await res.text());
      console.log('[ML] Pipeline saved:', pipelineName);
    } catch (err) {
      console.error('[ML] Save failed:', err);
    }
  }, [nodes, edges, pipelineName]);

  // ── Load pipeline ──────────────────────────────────────────────────
  const handleLoad = useCallback(async () => {
    const name = window.prompt('Pipeline name to load:');
    if (!name) return;

    try {
      const res = await fetch(`${BACKEND}/ml/pipeline/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(await res.text());
      const pipeline = await res.json();

      setPipelineName(pipeline.name);

      const restored = (pipeline.nodes ?? []).map(n => ({
        id:       n.id,
        type:     n.type,
        position: n.position,
        style:    n.style ?? {},
        data: {
          label:          n.label,
          status:         'idle',
          config:         n.config ?? {},
          onConfigChange: (patch) => handleNodeConfig(n.id, patch),
          onRemove:       () => handleRemoveNode(n.id),
          onTrain:        n.type === 'trainer' ? () => handleTrain(n.id) : undefined,
        },
      }));

      restored.forEach(n => { configsRef.current[n.id] = n.data.config; });

      setNodes(restored);
      setEdges((pipeline.edges ?? []).map(e => ({ ...e, animated: true, style: { stroke: '#64748b' } })));
      setPipelineStatus('idle');
    } catch (err) {
      console.error('[ML] Load failed:', err);
    }
  }, [handleNodeConfig, handleRemoveNode, handleTrain, setNodes, setEdges]);

  // ── Export JSON (download) ─────────────────────────────────────────
  const handleExportJSON = useCallback(() => {
    const snapshot = nodes.map(n => ({
      ...n,
      data: { ...n.data, config: configsRef.current[n.id] ?? n.data?.config ?? {} },
    }));
    const pipeline = serializePipeline(pipelineName, snapshot, edges);
    const blob = new Blob([JSON.stringify(pipeline, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${pipelineName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, pipelineName]);

  // ── Clear canvas ───────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    if (!window.confirm('Clear the entire pipeline?')) return;
    setNodes([]);
    setEdges([]);
    configsRef.current = {};
    setPipelineStatus('idle');
  }, [setNodes, setEdges]);

  return (
    <div className="flex flex-col w-full h-full bg-slate-950">
      <MLHeader
        pipelineName={pipelineName}
        onNameChange={setPipelineName}
        status={pipelineStatus}
        onClear={handleClear}
        onSave={handleSave}
        onLoad={handleLoad}
        onExportJSON={handleExportJSON}
      />

      <div className="flex flex-1 min-h-0">
        <MLNodePanel collapsed={panelCollapsed} onToggle={() => setPanelCollapsed(c => !c)} />

        <div className="flex-1 min-w-0">
          <MLCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            onNodeConfig={handleNodeConfig}
            onTrain={handleTrain}
            onRemoveNode={handleRemoveNode}
          />
        </div>
      </div>
    </div>
  );
};

export default MachineLearning;