"""
ML FastAPI router — all endpoints under /ml/.
"""

from __future__ import annotations
import json
import os
import pickle
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any

from .pipeline import execute

logger    = logging.getLogger(__name__)
router    = APIRouter(prefix="/ml", tags=["ML"])

# Directories for persisted pipelines and trained models
_BASE       = os.path.dirname(os.path.dirname(__file__))
PIPELINES_DIR = os.path.join(_BASE, "ml_pipelines")
MODELS_DIR    = os.path.join(_BASE, "ml_models")


def _ensure_dirs():
    os.makedirs(PIPELINES_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR,    exist_ok=True)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class EdgeSchema(BaseModel):
    id:           str
    source:       str
    target:       str
    sourceHandle: str | None = None
    targetHandle: str | None = None


class NodeSchema(BaseModel):
    id:       str
    type:     str
    position: dict[str, float] = Field(default_factory=dict)
    config:   dict[str, Any]   = Field(default_factory=dict)
    label:    str = ""
    style:    dict[str, Any]   = Field(default_factory=dict)


class PipelineSchema(BaseModel):
    name:          str
    nodes:         list[NodeSchema] = Field(default_factory=list)
    edges:         list[EdgeSchema] = Field(default_factory=list)
    train_node_id: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/pipeline/run")
async def run_pipeline(pipeline: PipelineSchema):
    """Execute the full ML pipeline and return per-node results."""
    print('help help')
    try:
        result = execute(pipeline.model_dump())
        print(result)
        return result
    except Exception as exc:
        logger.error("Pipeline execution failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/pipeline/save")
async def save_pipeline(pipeline: PipelineSchema):
    """Persist a pipeline JSON to disk."""
    _ensure_dirs()
    safe_name = pipeline.name.strip().replace(" ", "_") or "pipeline"
    path      = os.path.join(PIPELINES_DIR, f"{safe_name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(pipeline.model_dump(), f, indent=2)
    return {"ok": True, "path": path}


@router.get("/pipeline/{name}")
async def load_pipeline(name: str):
    """Load a saved pipeline JSON by name."""
    _ensure_dirs()
    path = os.path.join(PIPELINES_DIR, f"{name}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Pipeline '{name}' not found.")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/pipelines")
async def list_pipelines():
    """List all saved pipeline names."""
    _ensure_dirs()
    files = [f[:-5] for f in os.listdir(PIPELINES_DIR) if f.endswith(".json")]
    return {"pipelines": sorted(files)}


@router.delete("/pipeline/{name}")
async def delete_pipeline(name: str):
    """Delete a saved pipeline."""
    path = os.path.join(PIPELINES_DIR, f"{name}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Pipeline '{name}' not found.")
    os.remove(path)
    return {"ok": True}


@router.get("/models")
async def list_models():
    """List all saved trained model files."""
    _ensure_dirs()
    files = [f[:-4] for f in os.listdir(MODELS_DIR) if f.endswith(".pkl")]
    return {"models": sorted(files)}


@router.get("/models/{name}")
async def model_info(name: str):
    """Return metadata about a saved model."""
    path = os.path.join(MODELS_DIR, f"{name}.pkl")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found.")
    with open(path, "rb") as f:
        payload = pickle.load(f)
    return {
        "name":         name,
        "task":         payload.get("task", "unknown"),
        "feature_cols": payload.get("feature_cols", []),
        "model_type":   type(payload.get("model")).__name__,
    }
