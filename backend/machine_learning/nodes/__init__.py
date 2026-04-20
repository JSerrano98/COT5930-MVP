"""
ML pipeline node executors.
Each function receives the node config dict and the upstream DataFrame,
and returns a (result_dict, output_DataFrame) tuple.
"""

from .data_loader      import run as run_data_loader
from .preprocessor     import run as run_preprocessor
from .feature_engineer import run as run_feature_engineer
from .splitter         import run as run_splitter
from .model_selector   import run as run_model
from .trainer          import run as run_trainer
from .evaluator        import run as run_evaluator
from .ensemble         import run as run_ensemble

NODE_RUNNERS = {
    "data_loader":  run_data_loader,
    "preprocessor": run_preprocessor,
    "feature":      run_feature_engineer,
    "split":        run_splitter,
    "model":        run_model,
    "trainer":      run_trainer,
    "evaluator":    run_evaluator,
    "ensemble":     run_ensemble,
}
