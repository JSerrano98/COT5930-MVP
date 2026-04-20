"""
ML Pipeline executor.

Receives the serialized pipeline JSON (nodes + edges), performs a topological
sort, and executes each node in order passing the output of each node as the
input of its successor.
"""

from __future__ import annotations
import logging
from collections import defaultdict, deque
from typing import Any

from .nodes import NODE_RUNNERS

logger = logging.getLogger(__name__)


# ── Topological sort ──────────────────────────────────────────────────────────

def _topo_sort(node_ids: list[str], edges: list[dict]) -> list[str]:
    """Kahn's algorithm — returns nodes in execution order."""
    in_degree: dict[str, int]      = defaultdict(int)
    successors: dict[str, list[str]] = defaultdict(list)

    for nid in node_ids:
        if nid not in in_degree:
            in_degree[nid] = 0

    for e in edges:
        src, tgt = e["source"], e["target"]
        successors[src].append(tgt)
        in_degree[tgt] += 1

    queue  = deque(nid for nid in node_ids if in_degree[nid] == 0)
    order  = []

    while queue:
        nid = queue.popleft()
        order.append(nid)
        for succ in successors[nid]:
            in_degree[succ] -= 1
            if in_degree[succ] == 0:
                queue.append(succ)

    if len(order) != len(node_ids):
        raise ValueError("Pipeline graph contains a cycle — please fix the connections.")

    return order


# ── Pipeline execution ────────────────────────────────────────────────────────

def execute(pipeline: dict) -> dict:
    """
    Execute the full pipeline.

    Returns a dict:
        {
          "node_results":  [ {"id": ..., "result": {...}}, ... ],
          "trainer_result": {...},    # result from the trainer node (if any)
          "ok": True,
        }
    """
    nodes_raw  = pipeline.get("nodes", [])
    edges_raw  = pipeline.get("edges", [])
    train_node = pipeline.get("train_node_id")

    nodes_by_id = {n["id"]: n for n in nodes_raw}
    node_ids    = list(nodes_by_id.keys())

    order = _topo_sort(node_ids, edges_raw)

    # Map: node_id → output data (DataFrame or splits dict)
    outputs: dict[str, Any] = {}
    node_results: list[dict] = []
    trainer_result: dict = {}

    for nid in order:
        node   = nodes_by_id[nid]
        ntype  = node["type"]
        config = node.get("config", {})

        runner = NODE_RUNNERS.get(ntype)
        if runner is None:
            logger.warning("No runner for node type '%s' — skipping.", ntype)
            continue

        # Collect ALL upstream outputs (supports multi-input nodes like Ensemble).
        # For single-input nodes the first upstream is passed as-is.
        # For multi-input nodes a list of upstream outputs is passed.
        all_upstreams = [
            outputs[e["source"]]
            for e in edges_raw
            if e["target"] == nid and e["source"] in outputs
        ]
        if not all_upstreams:
            upstream = None
        elif len(all_upstreams) == 1:
            upstream = all_upstreams[0]
        else:
            upstream = all_upstreams  # list — Ensemble runner handles this

        logger.info("Executing node %s [%s]", nid, ntype)
        try:
            result, output = runner(config, upstream)
        except Exception as exc:
            logger.error("Node %s failed: %s", nid, exc)
            raise RuntimeError(f"Node '{node.get('label', nid)}' ({ntype}) failed: {exc}") from exc

        outputs[nid] = output
        node_results.append({"id": nid, "result": result})

        if nid == train_node:
            trainer_result = result

    return {
        "ok":             True,
        "node_results":   node_results,
        "trainer_result": trainer_result,
    }
