"""
ML Prediction Sensor

A DerivedSensor subclass that loads a trained scikit-learn model (saved by the
ML Workbench) and streams real-time predictions over LSL.

It connects to an existing LSL source stream, buffers incoming samples, and
on each process() call feeds the most-recent window of features into the model,
pushing the prediction(s) as a new LSL outlet.

Usage example
─────────────
    from sensors.ml_sensor import MLPredictionSensor

    sensor = MLPredictionSensor(
        uid         = "ml_stress_predictor",
        name        = "StressPredictor",
        type        = "ML",
        source_name = "EEG_AlphaPower",   # the LSL stream to read from
        model_path  = "/path/to/my_model.pkl",
    )
    sensor.run()           # blocks; use sensor.start() inside a larger app
"""

from __future__ import annotations

import pickle
import os
import numpy as np
from dataclasses import dataclass, field
from sensors.sensor import DerivedSensor


@dataclass
class MLPredictionSensor(DerivedSensor):
    """
    Derives real-time ML predictions from a source LSL stream.

    The pickle file is expected to be a dict produced by the ML Workbench::

        {
            "model":        <sklearn estimator>,
            "task":         "regression" | "classification",
            "feature_cols": [...],
            "label_col":    "...",
            ...
        }

    The number of output channels is 1 for regression and 1 for
    classification (class label).  For classification, a second outlet
    channel containing the *confidence* (max class probability) is added
    when the model supports predict_proba.
    """

    model_path: str = ""

    # ── set automatically after loading the pickle ──
    _model:         object          = field(init=False, default=None)
    _task:          str             = field(init=False, default="")
    _feature_cols:  list[str]       = field(init=False, default_factory=list)
    _has_proba:     bool            = field(init=False, default=False)

    def __post_init__(self):
        # Channels and sample_rate come from the model/source; we let the
        # parent validate after we set them based on the loaded model.
        # We defer channel count until _setup(); temporarily set 1.
        if not self.model_path:
            raise ValueError("model_path is required for MLPredictionSensor")

        # Default: 1 prediction channel.  May be bumped to 2 in _setup if
        # predict_proba is available on a classification model.
        if self.channels < 1:
            object.__setattr__(self, 'channels', 1)

        super().__post_init__()

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _load_model(self):
        resolved = self.model_path
        if not os.path.isabs(resolved):
            backend_root = os.path.dirname(os.path.dirname(__file__))
            resolved = os.path.normpath(os.path.join(backend_root, resolved))

        if not os.path.exists(resolved):
            raise FileNotFoundError(f"Model file not found: {resolved}")

        with open(resolved, "rb") as f:
            bundle = pickle.load(f)

        self._model        = bundle["model"]
        self._task         = bundle.get("task", "regression")
        self._feature_cols = bundle.get("feature_cols", [])
        self._has_proba    = (
            self._task == "classification"
            and hasattr(self._model, "predict_proba")
        )

        print(
            f"[{self.name}] Loaded '{self._task}' model "
            f"({len(self._feature_cols)} features) from {resolved}"
        )

    # ─────────────────────────────────────────────────────────────────────────
    # DerivedSensor hooks
    # ─────────────────────────────────────────────────────────────────────────

    def _setup(self):
        self._load_model()

        # Decide channel count based on model capabilities
        n_channels = 2 if self._has_proba else 1
        object.__setattr__(self, 'channels', n_channels)

        # Rebuild channel labels to match
        labels = ["prediction"]
        if self._has_proba:
            labels.append("confidence")
        object.__setattr__(self, 'channel_labels', labels)

        # Now connect to the source stream
        super()._setup()

    def process(self, buffer: np.ndarray) -> list[float] | None:
        """
        Take the most recent sample from the buffer, run it through the model,
        and return [prediction] (or [prediction, confidence] for classifiers
        with predict_proba).

        buffer shape: (n_samples, n_source_channels)
        """
        if buffer is None or len(buffer) == 0:
            return None

        # Use only the most recent sample row
        sample = buffer[-1]

        # If feature_cols are known, we expect sample length to match.
        # We pass it directly as a (1, n_features) array.
        n_features = len(self._feature_cols) if self._feature_cols else sample.shape[0]

        if sample.shape[0] < n_features:
            return None  # not enough channels yet

        X = sample[:n_features].reshape(1, -1)

        try:
            prediction = float(self._model.predict(X)[0])

            if self._has_proba:
                proba = self._model.predict_proba(X)[0]
                confidence = float(np.max(proba))
                return [prediction, confidence]

            return [prediction]
        except Exception as exc:
            print(f"[{self.name}] Prediction error: {exc}")
            return None
