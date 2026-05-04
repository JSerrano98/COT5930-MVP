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
from .model_workbench import (
    MODEL_SPECS,
    TrainRequest as WorkbenchTrainRequest,
    get_dataset_columns,
    get_dataset_profile,
    clean_dataset,
    train_model,
)

logger    = logging.getLogger(__name__)
router    = APIRouter(prefix="/ml", tags=["ML"])

_BASE         = os.environ.get('APP_USER_DATA') or os.path.dirname(os.path.dirname(__file__))
PIPELINES_DIR = os.path.join(_BASE, "ml_pipelines")
MODELS_DIR    = os.path.join(_BASE, "ml_models")


def _ensure_dirs():
    os.makedirs(PIPELINES_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR,    exist_ok=True)



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


class ModelTrainSchema(BaseModel):
    dataset_path: str
    label_col: str
    model_key: str
    model_name: str = ""
    params: dict[str, Any] = Field(default_factory=dict)
    test_size: float = 0.2
    val_size: float = 0.1
    random_state: int = 42
    shuffle: bool = True
    save_dir: str = ""   # optional override for output directory
    # Prepare step
    scaler: str = "none"
    poly_degree: int = 1
    log_transform_cols: list[str] = Field(default_factory=list)
    sqrt_transform_cols: list[str] = Field(default_factory=list)
    feature_selection: str = "none"
    feature_selection_k: int = 10
    variance_threshold: float = 0.0
    correlation_threshold: float = 0.95
    feature_cols: list[str] = Field(default_factory=list)


class DatasetColumnsSchema(BaseModel):
    dataset_path: str


class ColumnOpSchema(BaseModel):
    col: str
    action: str  # keep | drop | fill_mean | fill_median | fill_mode | fill_zero | drop_rows


class CleanDatasetSchema(BaseModel):
    dataset_path: str
    drop_duplicates: bool = False
    column_ops: list[ColumnOpSchema] = Field(default_factory=list)
    clean_dir: str = ''



@router.post("/pipeline/run")
async def run_pipeline(pipeline: PipelineSchema):
    """Execute the full ML pipeline and return per-node results."""
    try:
        result = execute(pipeline.model_dump())
        print('this is the final result')
        print(result)
        return result
    except Exception as exc:
        logger.error("Pipeline execution failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/workbench/models")
async def list_workbench_models():
    """List supported model types and editable parameter schemas."""
    return {"models": MODEL_SPECS}


@router.post("/workbench/profile")
async def profile_dataset(body: DatasetColumnsSchema):
    """Return per-column stats for the cleaning step."""
    try:
        return get_dataset_profile(body.dataset_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/workbench/clean")
async def clean_dataset_endpoint(body: CleanDatasetSchema):
    """Apply cleaning operations and return the path of the saved cleaned CSV."""
    try:
        result = clean_dataset(
            body.dataset_path,
            body.drop_duplicates,
            [op.model_dump() for op in body.column_ops],
            body.clean_dir,
        )
        return result
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/workbench/columns")
async def get_workbench_columns(payload: DatasetColumnsSchema):
    """Inspect a CSV and return available columns for label selection."""
    try:
        return get_dataset_columns(payload.dataset_path)
    except Exception as exc:
        logger.error("Dataset columns lookup failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/workbench/train")
async def train_workbench_model(payload: ModelTrainSchema):
    """Train a single selected model directly from dataset + params."""
    try:
        req = WorkbenchTrainRequest(
            dataset_path=payload.dataset_path,
            label_col=payload.label_col,
            model_key=payload.model_key,
            model_name=payload.model_name,
            params=payload.params,
            test_size=payload.test_size,
            val_size=payload.val_size,
            random_state=payload.random_state,
            shuffle=payload.shuffle,
            scaler=payload.scaler,
            poly_degree=payload.poly_degree,
            log_transform_cols=payload.log_transform_cols,
            sqrt_transform_cols=payload.sqrt_transform_cols,
            feature_selection=payload.feature_selection,
            feature_selection_k=payload.feature_selection_k,
            variance_threshold=payload.variance_threshold,
            correlation_threshold=payload.correlation_threshold,
            feature_cols=payload.feature_cols,
        )
        _ensure_dirs()
        out_dir = payload.save_dir.strip() if payload.save_dir.strip() else MODELS_DIR
        return train_model(req, out_dir)
    except Exception as exc:
        logger.error("Workbench training failed: %s", exc)
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