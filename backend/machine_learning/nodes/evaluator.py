"""
Evaluator node — computes evaluation metrics on the test split.
"""

from __future__ import annotations
import numpy as np


def run(config: dict, upstream):
    if not isinstance(upstream, dict):
        raise ValueError("Evaluator requires splits dict from Trainer.")

    model   = upstream.get("trained_model")
    X_test  = upstream.get("X_test")
    y_test  = upstream.get("y_test")
    task    = upstream.get("task", "classification")

    if model is None:
        raise ValueError("Evaluator: no trained model found. Connect Trainer → Evaluator.")
    if X_test is None or len(X_test) == 0:
        raise ValueError("Evaluator: test set is empty.")

    y_pred = model.predict(X_test)

    if task == "classification":
        from sklearn.metrics import (
            accuracy_score, f1_score, precision_score, recall_score,
            roc_auc_score, confusion_matrix, classification_report
        )

        classes = sorted(set(y_test))
        avg     = "binary" if len(classes) == 2 else "weighted"

        accuracy  = float(accuracy_score(y_test,  y_pred))
        f1        = float(f1_score(y_test,        y_pred, average=avg, zero_division=0))
        precision = float(precision_score(y_test, y_pred, average=avg, zero_division=0))
        recall    = float(recall_score(y_test,    y_pred, average=avg, zero_division=0))
        cm        = confusion_matrix(y_test, y_pred).tolist()
        report    = classification_report(y_test, y_pred, zero_division=0)

        roc_auc = None
        if len(classes) == 2 and hasattr(model, "predict_proba"):
            try:
                y_prob  = model.predict_proba(X_test)[:, 1]
                roc_auc = float(roc_auc_score(y_test, y_prob))
            except Exception:
                pass

        result = {
            "accuracy":          accuracy,
            "f1":                f1,
            "precision":         precision,
            "recall":            recall,
            "roc_auc":           roc_auc,
            "confusion_matrix":  cm,
            "class_report":      report,
        }

    else:  # regression
        from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

        mse = float(mean_squared_error(y_test, y_pred))
        mae = float(mean_absolute_error(y_test, y_pred))
        r2  = float(r2_score(y_test, y_pred))

        result = {"mse": mse, "mae": mae, "r2": r2}

    return result, upstream  # pass through for chaining
