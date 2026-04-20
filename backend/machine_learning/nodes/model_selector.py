"""
Model Selector node — builds an untrained sklearn / keras estimator
based on the user's config and passes it downstream.
"""

from __future__ import annotations


def _build_sklearn(model_key: str, params: dict, task: str):
    from sklearn.svm             import SVC, SVR
    from sklearn.ensemble        import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
    from sklearn.neighbors       import KNeighborsClassifier, KNeighborsRegressor
    from sklearn.linear_model    import LogisticRegression, Ridge, Lasso, ElasticNet
    from sklearn.discriminant_analysis import LinearDiscriminantAnalysis

    is_clf = task == "classification"

    builders = {
        "svm": lambda: SVC(C=float(params.get("C", 1.0)), kernel=params.get("kernel", "rbf"), probability=True) if is_clf else SVR(C=float(params.get("C", 1.0)), kernel=params.get("kernel", "rbf")),
        "random_forest":  lambda: RandomForestClassifier(n_estimators=int(params.get("n_estimators", 100)), max_depth=int(params["max_depth"]) if params.get("max_depth") else None, random_state=42) if is_clf else RandomForestRegressor(n_estimators=int(params.get("n_estimators", 100)), random_state=42),
        "gradient_boost": lambda: GradientBoostingClassifier(n_estimators=int(params.get("n_estimators", 100)), learning_rate=float(params.get("learning_rate", 0.1)), random_state=42) if is_clf else GradientBoostingRegressor(n_estimators=int(params.get("n_estimators", 100)), learning_rate=float(params.get("learning_rate", 0.1)), random_state=42),
        "knn":         lambda: KNeighborsClassifier(n_neighbors=int(params.get("n_neighbors", 5)), metric=params.get("metric", "euclidean")) if is_clf else KNeighborsRegressor(n_neighbors=int(params.get("n_neighbors", 5))),
        "logistic":    lambda: LogisticRegression(C=float(params.get("C", 1.0)), max_iter=int(params.get("max_iter", 1000))),
        "ridge":       lambda: Ridge(alpha=float(params.get("alpha", 1.0))),
        "lasso":       lambda: Lasso(alpha=float(params.get("alpha", 1.0)), max_iter=int(params.get("max_iter", 1000))),
        "elastic_net": lambda: ElasticNet(alpha=float(params.get("alpha", 1.0)), l1_ratio=float(params.get("l1_ratio", 0.5)), max_iter=int(params.get("max_iter", 1000))),
        "lda":         lambda: LinearDiscriminantAnalysis(solver=params.get("solver", "svd")),
    }

    if model_key not in builders:
        raise ValueError(f"ModelSelector: unknown classical model '{model_key}'")
    return builders[model_key]()


def run(config: dict, upstream):
    model_key = config.get("model", "svm")
    task      = config.get("task",  "classification")
    params    = config.get("params", {})

    # Neural models — return a spec dict; Trainer will build the actual model
    neural = {"mlp", "cnn1d", "lstm", "eegnet"}
    if model_key in neural:
        model_obj = {"_type": "neural", "arch": model_key, "params": params, "task": task}
    else:
        model_obj = _build_sklearn(model_key, params, task)

    result = {"model": model_key, "task": task}

    # Pass splits through alongside the model object
    if isinstance(upstream, dict):
        upstream["model_obj"] = model_obj
        upstream["model_key"] = model_key
        upstream["task"]      = task
        return result, upstream
    else:
        return result, {"model_obj": model_obj, "model_key": model_key, "task": task}
