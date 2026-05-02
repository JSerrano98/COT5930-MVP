"""
Model-centric ML workbench utilities.

This module powers a simplified workflow where users select one model,
configure a small parameter set, and train directly from a dataset.
"""

from __future__ import annotations

import os
import pickle
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import ElasticNet, Lasso, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import train_test_split


MODEL_SPECS: dict[str, dict[str, Any]] = {
    "ridge": {
        "label": "Ridge Regression",
        "task": "regression",
        "params": {
            "alpha": {"type": "float", "default": 1.0, "min": 0.0, "step": 0.1},
        },
    },
    "lasso": {
        "label": "Lasso Regression",
        "task": "regression",
        "params": {
            "alpha": {"type": "float", "default": 1.0, "min": 0.0, "step": 0.1},
            "max_iter": {"type": "int", "default": 1000, "min": 100, "step": 100},
        },
    },
    "elastic_net": {
        "label": "Elastic Net",
        "task": "regression",
        "params": {
            "alpha": {"type": "float", "default": 1.0, "min": 0.0, "step": 0.1},
            "l1_ratio": {"type": "float", "default": 0.5, "min": 0.0, "max": 1.0, "step": 0.05},
            "max_iter": {"type": "int", "default": 1000, "min": 100, "step": 100},
        },
    },
    "logistic_regression": {
        "label": "Logistic Regression",
        "task": "classification",
        "params": {
            "C": {"type": "float", "default": 1.0, "min": 0.0001, "step": 0.1},
            "max_iter": {"type": "int", "default": 1000, "min": 100, "step": 100},
            "solver": {
                "type": "enum",
                "default": "lbfgs",
                "options": ["lbfgs", "liblinear", "newton-cg", "sag", "saga"],
            },
        },
    },
}


@dataclass
class TrainRequest:
    dataset_path: str
    label_col: str
    model_key: str
    model_name: str
    params: dict[str, Any]
    test_size: float = 0.2
    val_size: float = 0.1
    random_state: int = 42
    shuffle: bool = True


def _resolve_dataset_path(path: str) -> str:
    if os.path.isabs(path):
        return path
    backend_root = os.path.dirname(os.path.dirname(__file__))
    return os.path.normpath(os.path.join(backend_root, path))


def _safe_model_name(name: str, model_key: str) -> str:
    candidate = (name or "").strip().replace(" ", "_")
    if not candidate:
        candidate = f"{model_key}_model"
    return candidate


def get_dataset_columns(dataset_path: str) -> dict[str, Any]:
    resolved = _resolve_dataset_path(dataset_path)
    if not os.path.exists(resolved):
        raise FileNotFoundError(f"Dataset not found: {resolved}")

    df = pd.read_csv(resolved)
    return {
        "path": resolved,
        "rows": int(len(df)),
        "columns": list(df.columns),
    }


def get_dataset_profile(dataset_path: str) -> dict[str, Any]:
    """Return per-column stats useful for data cleaning decisions."""
    resolved = _resolve_dataset_path(dataset_path)
    if not os.path.exists(resolved):
        raise FileNotFoundError(f"Dataset not found: {resolved}")

    df = pd.read_csv(resolved)
    total = len(df)
    cols = []
    for col in df.columns:
        null_count = int(df[col].isna().sum())
        cols.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "null_count": null_count,
            "null_pct": round(null_count / total * 100, 1) if total > 0 else 0.0,
            "unique_count": int(df[col].nunique()),
            "sample": [str(s) for s in df[col].dropna().head(3).tolist()],
        })
    return {
        "path": resolved,
        "rows": total,
        "duplicate_rows": int(df.duplicated().sum()),
        "columns": cols,
    }


def clean_dataset(
    dataset_path: str,
    drop_duplicates: bool,
    column_ops: list[dict[str, str]],
) -> dict[str, Any]:
    """Apply cleaning operations and save the result as a new _cleaned CSV."""
    resolved = _resolve_dataset_path(dataset_path)
    if not os.path.exists(resolved):
        raise FileNotFoundError(f"Dataset not found: {resolved}")

    df = pd.read_csv(resolved)
    original_rows = len(df)

    if drop_duplicates:
        df = df.drop_duplicates()

    cols_to_drop: list[str] = []
    for op in column_ops:
        col    = op.get("col", "")
        action = op.get("action", "keep")
        if col not in df.columns or action == "keep":
            continue
        if action == "drop":
            cols_to_drop.append(col)
        elif action == "fill_mean":
            df[col] = df[col].fillna(df[col].mean())
        elif action == "fill_median":
            df[col] = df[col].fillna(df[col].median())
        elif action == "fill_mode":
            mode_val = df[col].mode()
            if len(mode_val) > 0:
                df[col] = df[col].fillna(mode_val.iloc[0])
        elif action == "fill_zero":
            df[col] = df[col].fillna(0)
        elif action == "drop_rows":
            df = df.dropna(subset=[col])

    if cols_to_drop:
        df = df.drop(columns=cols_to_drop)

    base, ext = os.path.splitext(resolved)
    out_path = f"{base}_cleaned{ext}"
    df.to_csv(out_path, index=False)

    return {
        "cleaned_path": out_path,
        "original_rows": original_rows,
        "cleaned_rows": int(len(df)),
        "dropped_rows": original_rows - int(len(df)),
        "dropped_cols": len(cols_to_drop),
    }


def _build_model(model_key: str, params: dict[str, Any]):
    if model_key == "ridge":
        return Ridge(alpha=float(params.get("alpha", 1.0)))
    if model_key == "lasso":
        return Lasso(
            alpha=float(params.get("alpha", 1.0)),
            max_iter=int(params.get("max_iter", 1000)),
        )
    if model_key == "elastic_net":
        return ElasticNet(
            alpha=float(params.get("alpha", 1.0)),
            l1_ratio=float(params.get("l1_ratio", 0.5)),
            max_iter=int(params.get("max_iter", 1000)),
        )
    if model_key == "logistic_regression":
        return LogisticRegression(
            C=float(params.get("C", 1.0)),
            max_iter=int(params.get("max_iter", 1000)),
            solver=str(params.get("solver", "lbfgs")),
        )
    raise ValueError(f"Unknown model '{model_key}'")


def _rmse(y_true, y_pred) -> float:
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def _regression_metrics(model, X, y) -> dict[str, float | None]:
    if X is None or len(X) == 0:
        return {"r2": None, "rmse": None}
    pred = model.predict(X)
    return {
        "r2": float(r2_score(y, pred)),
        "rmse": _rmse(y, pred),
    }


def _classification_metrics(model, X, y) -> dict[str, float | None]:
    if X is None or len(X) == 0:
        return {"accuracy": None, "f1_weighted": None}
    pred = model.predict(X)
    return {
        "accuracy": float(accuracy_score(y, pred)),
        "f1_weighted": float(f1_score(y, pred, average="weighted", zero_division=0)),
    }


def train_model(req: TrainRequest, models_dir: str) -> dict[str, Any]:
    spec = MODEL_SPECS.get(req.model_key)
    if spec is None:
        raise ValueError(f"Unsupported model '{req.model_key}'")

    dataset_path = _resolve_dataset_path(req.dataset_path)
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    df = pd.read_csv(dataset_path)
    if req.label_col not in df.columns:
        raise ValueError(f"Label column '{req.label_col}' not found in dataset")

    X = df.drop(columns=[req.label_col])
    y = df[req.label_col]

    stratify = y if spec["task"] == "classification" else None
    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X,
        y,
        test_size=float(req.test_size),
        random_state=int(req.random_state),
        shuffle=bool(req.shuffle),
        stratify=stratify,
    )

    if req.val_size > 0:
        adjusted_val = float(req.val_size) / (1.0 - float(req.test_size))
        stratify_val = y_trainval if spec["task"] == "classification" else None
        X_train, X_val, y_train, y_val = train_test_split(
            X_trainval,
            y_trainval,
            test_size=adjusted_val,
            random_state=int(req.random_state),
            shuffle=bool(req.shuffle),
            stratify=stratify_val,
        )
    else:
        X_train, y_train = X_trainval, y_trainval
        X_val = pd.DataFrame(columns=X.columns)
        y_val = pd.Series(dtype=y.dtype)

    model = _build_model(req.model_key, req.params)
    model.fit(X_train, y_train)

    if spec["task"] == "classification":
        train_metrics = _classification_metrics(model, X_train, y_train)
        val_metrics = _classification_metrics(model, X_val, y_val)
        test_metrics = _classification_metrics(model, X_test, y_test)
    else:
        train_metrics = _regression_metrics(model, X_train, y_train)
        val_metrics = _regression_metrics(model, X_val, y_val)
        test_metrics = _regression_metrics(model, X_test, y_test)

    os.makedirs(models_dir, exist_ok=True)
    model_name = _safe_model_name(req.model_name, req.model_key)
    model_path = os.path.join(models_dir, f"{model_name}.pkl")

    with open(model_path, "wb") as f:
        pickle.dump(
            {
                "model": model,
                "model_key": req.model_key,
                "task": spec["task"],
                "feature_cols": list(X.columns),
                "label_col": req.label_col,
                "params": req.params,
            },
            f,
        )

    return {
        "ok": True,
        "task": spec["task"],
        "model_key": req.model_key,
        "model_name": model_name,
        "model_path": model_path,
        "dataset": {
            "path": dataset_path,
            "rows": int(len(df)),
            "columns": list(df.columns),
            "label_col": req.label_col,
        },
        "split": {
            "train": int(len(X_train)),
            "val": int(len(X_val)),
            "test": int(len(X_test)),
        },
        "metrics": {
            "train": train_metrics,
            "val": val_metrics,
            "test": test_metrics,
        },
    }