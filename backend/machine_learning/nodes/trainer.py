"""
Trainer node — fits the model on the training split.
Supports sklearn estimators and a lightweight MLP via sklearn's MLPClassifier/Regressor.
Saves the trained model to disk.
"""

from __future__ import annotations
import os
import pickle
import logging
import numpy as np

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml_models")


def _ensure_models_dir():
    os.makedirs(MODELS_DIR, exist_ok=True)


def _train_sklearn(model_obj, splits: dict, config: dict):
    from sklearn.model_selection import cross_val_score

    X_train = splits["X_train"]
    y_train = splits["y_train"]
    X_val   = splits.get("X_val")
    y_val   = splits.get("y_val")

    cv_folds = int(config.get("cv", 0))
    task     = splits.get("task", "classification")

    model_obj.fit(X_train, y_train)

    train_score = float(model_obj.score(X_train, y_train))
    val_score   = float(model_obj.score(X_val, y_val)) if X_val is not None and len(X_val) > 0 else None

    cv_scores = None
    if cv_folds > 1:
        scoring = "accuracy" if task == "classification" else "r2"
        cv_scores = cross_val_score(model_obj, X_train, y_train, cv=cv_folds, scoring=scoring).tolist()
        logger.info("CV scores (%d-fold): %s", cv_folds, cv_scores)

    return model_obj, {
        "train_acc": train_score,
        "val_acc":   val_score,
        "cv_scores": cv_scores,
        "cv_mean":   float(np.mean(cv_scores)) if cv_scores else None,
    }


def _train_neural_mlp(spec: dict, splits: dict, config: dict):
    """Fallback MLP using sklearn — no extra dependencies required."""
    from sklearn.neural_network import MLPClassifier, MLPRegressor

    task   = splits.get("task", "classification")
    params = spec.get("params", {})

    # Parse hidden layer sizes
    raw_layers = str(params.get("hidden_layers", "128,64"))
    hidden     = tuple(int(x.strip()) for x in raw_layers.split(",") if x.strip().isdigit())
    dropout_alpha = float(params.get("dropout", 0.3))  # sklearn uses alpha for L2 reg

    epochs     = int(config.get("epochs",    100))
    lr         = float(config.get("lr",      0.001))
    batch_size = int(config.get("batchSize", 32))

    X_train = splits["X_train"]
    y_train = splits["y_train"]

    cls = MLPClassifier if task == "classification" else MLPRegressor
    model_obj = cls(
        hidden_layer_sizes=hidden,
        alpha=dropout_alpha,
        max_iter=epochs,
        learning_rate_init=lr,
        batch_size=batch_size,
        random_state=42,
        early_stopping=bool(config.get("earlyStop", True)),
        n_iter_no_change=int(config.get("patience", 10)),
    )
    model_obj.fit(X_train, y_train)

    train_score = float(model_obj.score(X_train, y_train))
    X_val, y_val = splits.get("X_val"), splits.get("y_val")
    val_score    = float(model_obj.score(X_val, y_val)) if X_val is not None and len(X_val) > 0 else None

    return model_obj, {"train_acc": train_score, "val_acc": val_score}


def run(config: dict, upstream):
    print('hello')
    if not isinstance(upstream, dict):
        raise ValueError("Trainer requires splits dict from a Split node (+ Model node).")

    splits    = upstream
    model_obj = splits.get("model_obj")
    if model_obj is None:
        raise ValueError("Trainer: no model found. Connect a Model node before Trainer.")

    model_name = (config.get("modelName") or "model").strip().replace(" ", "_") or "model"

    if isinstance(model_obj, dict) and model_obj.get("_type") == "neural":
        trained_model, metrics = _train_neural_mlp(model_obj, splits, config)
    else:
        trained_model, metrics = _train_sklearn(model_obj, splits, config)

    # Save model
    _ensure_models_dir()
    save_path = os.path.join(MODELS_DIR, f"{model_name}.pkl")
    with open(save_path, "wb") as f:
        pickle.dump({"model": trained_model, "feature_cols": splits.get("feature_cols", []), "task": splits.get("task", "classification")}, f)

    logger.info("Model saved to %s", save_path)

    # Pass trained model downstream for evaluation
    splits["trained_model"] = trained_model
    splits["model_path"]    = save_path

    result = {
        **metrics,
        "model_path": save_path,
        "progress":   100,
    }
    return result, splits
