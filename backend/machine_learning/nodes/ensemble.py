"""
Ensemble (Stacking) node.

Accepts a LIST of trainer outputs (each is a splits dict containing:
  trained_model, X_train, y_train, X_test, y_test, task, model_key).

Algorithm:
  1. For each base model: generate out-of-fold (OOF) predictions on X_train
     using cross_val_predict — avoids leakage into the meta-learner.
  2. Stack OOF predictions column-wise → X_train_meta
  3. Generate test-set predictions from each base model → X_test_meta
  4. Build meta-learner (Logistic / MLP / Ridge / GradientBoosting)
  5. Fit meta-learner on X_train_meta, evaluate on X_test_meta
  6. Save meta-learner and return metrics.
"""

from __future__ import annotations
import os
import pickle
import logging
import numpy as np

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "models")


def _build_meta_learner(key: str, task: str):
    from sklearn.linear_model   import LogisticRegression, Ridge
    from sklearn.ensemble       import GradientBoostingClassifier, GradientBoostingRegressor
    from sklearn.neural_network import MLPClassifier, MLPRegressor

    is_clf = task == "classification"
    lookup = {
        "logistic":      lambda: LogisticRegression(max_iter=1000) if is_clf else Ridge(),
        "ridge":         lambda: Ridge(),
        "mlp":           lambda: MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, random_state=42) if is_clf else MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=500, random_state=42),
        "gradient_boost": lambda: GradientBoostingClassifier(random_state=42) if is_clf else GradientBoostingRegressor(random_state=42),
    }
    if key not in lookup:
        raise ValueError(f"EnsembleNode: unknown meta-learner '{key}'")
    return lookup[key]()


def _oof_predictions(model, X_train, y_train, cv: int, use_proba: bool, task: str):
    """Generate out-of-fold predictions for the training set."""
    from sklearn.model_selection import cross_val_predict
    method = "predict_proba" if (use_proba and task == "classification" and hasattr(model, "predict_proba")) else "predict"
    preds  = cross_val_predict(model, X_train, y_train, cv=cv, method=method)
    # For multi-class predict_proba → keep as-is; for binary keep both columns
    return preds if preds.ndim > 1 else preds.reshape(-1, 1)


def _test_predictions(model, X_test, use_proba: bool, task: str):
    """Generate test predictions using a FULLY fitted model."""
    method = "predict_proba" if (use_proba and task == "classification" and hasattr(model, "predict_proba")) else "predict"
    preds  = getattr(model, method)(X_test)
    return preds if preds.ndim > 1 else preds.reshape(-1, 1)


def run(config: dict, upstream):
    if upstream is None:
        raise ValueError("EnsembleNode: no upstream inputs connected.")

    # Normalise to list
    splits_list = upstream if isinstance(upstream, list) else [upstream]

    if len(splits_list) == 0:
        raise ValueError("EnsembleNode: upstream list is empty.")

    meta_key  = config.get("metaLearner", "mlp")
    cv_folds  = int(config.get("cvFolds",  5))
    use_proba = bool(config.get("useProba", True))
    model_name = config.get("modelName", "ensemble").strip() or "ensemble"
    task      = splits_list[0].get("task", "classification")

    # Validate all splits share compatible shapes
    X_train = splits_list[0]["X_train"]
    y_train = splits_list[0]["y_train"]
    X_test  = splits_list[0]["X_test"]
    y_test  = splits_list[0]["y_test"]

    logger.info("EnsembleNode: stacking %d base model(s) with meta-learner '%s'", len(splits_list), meta_key)

    oof_train_cols: list[np.ndarray] = []
    oof_test_cols:  list[np.ndarray] = []

    for i, splits in enumerate(splits_list):
        base_model = splits.get("trained_model")
        if base_model is None:
            raise ValueError(f"EnsembleNode: base model {i} has no trained_model — ensure Trainer nodes ran successfully.")

        # OOF predictions on training data
        oof_tr = _oof_predictions(base_model, X_train, y_train, cv_folds, use_proba, task)
        oof_train_cols.append(oof_tr)

        # Predictions on test data (using already-fitted model)
        oof_te = _test_predictions(base_model, X_test, use_proba, task)
        oof_test_cols.append(oof_te)

    X_train_meta = np.hstack(oof_train_cols)
    X_test_meta  = np.hstack(oof_test_cols)

    # Build and fit meta-learner
    meta_model = _build_meta_learner(meta_key, task)
    meta_model.fit(X_train_meta, y_train)

    # Evaluate
    result: dict = {"base_model_count": len(splits_list)}
    if task == "classification":
        from sklearn.metrics import accuracy_score, f1_score
        y_pred = meta_model.predict(X_test_meta)
        result["accuracy"] = float(accuracy_score(y_test, y_pred))
        result["f1"]       = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
    else:
        from sklearn.metrics import mean_squared_error, r2_score
        y_pred = meta_model.predict(X_test_meta)
        result["mse"] = float(mean_squared_error(y_test, y_pred))
        result["r2"]  = float(r2_score(y_test, y_pred))

    # Save
    os.makedirs(MODELS_DIR, exist_ok=True)
    save_path = os.path.join(MODELS_DIR, f"{model_name}.pkl")
    with open(save_path, "wb") as f:
        pickle.dump({"meta_model": meta_model, "meta_key": meta_key, "task": task}, f)

    result["model_path"] = save_path
    logger.info("EnsembleNode: saved stacked model → %s  acc=%.3f", save_path, result.get("accuracy", result.get("r2", 0)))

    # Pass downstream (for chained evaluator or further nodes)
    output = {
        **splits_list[0],
        "trained_model": meta_model,
        "X_train": X_train_meta,
        "X_test":  X_test_meta,
        "y_train": y_train,
        "y_test":  y_test,
        "task":    task,
    }
    return result, output
