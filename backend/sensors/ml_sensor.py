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

from dataclasses import dataclass
from sensors.sensor import MLSensor


@dataclass
class MLPredictionSensor(MLSensor):
    """Backwards-compatible alias for the generic MLSensor implementation."""
    pass
