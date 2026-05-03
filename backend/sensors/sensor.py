"""
Sensor Node:

A standardized class that can be used to create LSL outlets for any type of sensor data wether raw or derivative.
This abstracts away the details of how to connect to the device and read data from it, 
allowing us to easily add new sensors in the future by just subclassing and implementing the connect and read_sample methods.

The class acts as a bridge between an unsupported physical sensor's SDK/API/protocol and the LabStreamingLayer,
allowing us to treat all sensors uniformly as LSL streams regardless of their underlying hardware or connection method.

For derived metrics that are computed from raw sensors (e.g. heart rate from EEG, channel band power from EEG),
this does the same. However it also provides a standard place to implement the logic for computing those metrics from the raw data.
Most importantly allows the computed values to be recorded by LSL.
"""

import time
import threading
import pickle
import os
import numpy as np
import pandas as pd
from pylsl import StreamInfo, StreamOutlet, StreamInlet, resolve_byprop
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

# ════════════════════════════════════════════════════════════════════
# BASE SENSOR - ABSTRACT CLASS THAT WRAPS ANY SENSOR INTO AN LSL OUTLET
# ════════════════════════════════════════════════════════════════════

@dataclass
class Sensor(ABC):
    """
    Base class that wraps any sensor into an LSL outlet.

    Subclass this and implement the _setup and _loop_body methods to create a new sensor. 
    """
    uid: str
    name: str
    type: str
    channels: int
    sample_rate: float
    channel_format: str = "float32"
    channel_labels: list[str] | None = None

    _outlet: StreamOutlet | None = field(init=False, default=None)
    _running: bool = field(init=False, default=False)
    _thread: threading.Thread | None = field(init=False, default=None)

    def __post_init__(self):
        casts = {
            "uid": str,
            "name": str,
            "type": str,
            "channels": int,
            "sample_rate": float,
            "channel_format": str,
        }

        for key, cast in casts.items():
            setattr(self, key, cast(getattr(self, key)))

        if self.channels < 1:
            raise ValueError("There must be at least 1 channel for a signal")

        # LSL nominal_srate=0 means irregular/event-driven stream timing.
        if self.sample_rate < 0:
            raise ValueError("Sample Rate must be >= 0 (use 0 for irregular streams)")

        if self.channel_labels is None:
            self.channel_labels = [
                f"{self.name}_{self.uid}_channel_{i+1}"
                for i in range(self.channels)
            ]
        else:
            self.channel_labels = list(self.channel_labels)

            if len(self.channel_labels) != self.channels:
                raise ValueError("channel_labels count must match the number of channels")
            
    def _create_outlet(self) -> StreamOutlet:
        info = StreamInfo(
            self.name,            # name
            self.type,            # type
            self.channels,        # channel_count
            self.sample_rate,     # nominal_srate
            self.channel_format,  # channel_format
            self.uid,             # source_id
        )

        # Add channel labels to the stream info description
        chns = info.desc().append_child("channels")
        for label in self.channel_labels:
            chns.append_child("channel").append_child_value("label", label)

        return StreamOutlet(info)
    
    @abstractmethod
    def _setup(self):
        """
        Called before the loop starts (connect device, resolve inlet, etc).
        """
        ...

    @abstractmethod
    def _loop_body(self):
        """
        Called repeatedly in the background thread.
        """
        ...

    def _teardown(self):
        """
        Optional cleanup.
        """
        pass

    def _run(self):
        """
        Background thread target function.
        """
        while self._running:
            self._loop_body()

    def start(self):
        """
        Start the sensor's background thread and begin streaming data to LSL.
        """
        self._setup()
        self._outlet = self._create_outlet()
        self._running = True
        self._thread = threading.Thread(
            target=self._run, daemon=True)
        self._thread.start()
        print(f"[{self.name}] Streaming")

    def stop(self):
        """
        Stop the sensor's background thread and clean up resources.
        """
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
        self._teardown()
        print(f"[{self.name}] Stopped")

    def run(self):
        """
        Start the sensor and block until Ctrl+C.
        Use this when running a sensor as a standalone script.
        Use start() instead when running multiple sensors or inside a larger app.
        """
        self.start()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()

    def push(self, sample: list[float]):
        """Push a single sample to the outlet."""
        if self._outlet:
            self._outlet.push_sample(sample)

# ════════════════════════════════════════════════════════════════════
# PHYSICAL SENSOR - FOR UNSUPPORTED DEVICES THAT REQUIRE A DRIVER/SDK/API CONNECTION
# ════════════════════════════════════════════════════════════════════

@dataclass
class PhysicalSensor(Sensor):
    """
    Base class for physical sensors that require a connection to an external device or API.
    """

    def connect(self):
        """
        Connect to the physical device and prepare for streaming.
        This gets called once when the sensor starts. Do any setup work here (e.g. open serial port, connect to API, etc).
        """
        ...

    @abstractmethod
    def read_sample(self) -> list[float] | None:
        """
        Read one sample from the device.
        Return a list of floats (one per channel), or None if no data ready.
        This gets called in a tight loop, so block or sleep as needed.
        """
        ...

    def disconnect(self):
        """
        Disconnect from the device and clean up resources.
        """
        pass

    # Base class hooks
    def _setup(self):
        print(f"[{self.name}] Connecting to device...")
        self.connect()

    def _loop_body(self):
        sample = self.read_sample()
        if sample is not None:
            self.push(sample)
        if self.sample_rate > 0:
            time.sleep(1.0 / self.sample_rate)

    def _teardown(self):
        self.disconnect()


# ════════════════════════════════════════════════════════════════════
# DERIVED SENSOR - FOR COMPUTED METRICS THAT DERIVE FROM RAW SENSORS
# ════════════════════════════════════════════════════════════════════

@dataclass
class DerivedSensor(Sensor):
    """
    Base class for derived sensors that compute metrics from raw sensor data.

    This is for sensors that don't connect to a physical device, 
    but instead compute some derived metric from one or more source LSL streams.
    This is done so that the derived metrics can also be recorded by LSL 
    and be treated uniformly by the frontend. 
   
    The base class handles connecting to the source stream(s) and buffering the raw data,
    while the subclass just implements the logic for computing the derived metric from the raw data.
    
    The source stream(s) are specified by the source_name and source_type fields,
    and the base class will automatically resolve the stream, connect to it, 
    and buffer the incoming data.        
    """
    source_name: str = ""
    source_type: str = ""
    buffer_seconds: float = 5.0
    process_interval: float = 0.1

    _inlet: StreamInlet | None = field(init=False, default=None)
    _buffer: np.ndarray | None = field(init=False, default=None)
    _buf_idx: int = field(init=False, default=0)
    _buf_full: bool = field(init=False, default=False)
    source_rate: float = field(init=False, default=0)
    _source_channel_labels: list[str] = field(init=False, default_factory=list)

    def __post_init__(self):
        super().__post_init__()

        if not self.source_name:
            raise ValueError("source_name is required — the name of the LSL stream to read from")

        if self.buffer_seconds <= 0:
            raise ValueError("buffer_seconds must be greater than 0")

        if self.process_interval <= 0:
            raise ValueError("process_interval must be greater than 0")

    @abstractmethod
    def process(self, buffer: np.ndarray) -> list[float] | None:
        """
        Process the rolling buffer and return a derived sample.

        Args:
            buffer: np.ndarray of shape (buffer_samples, source_channels).
                    Contains the most recent buffer_seconds of data from the source.
                    If the buffer hasn't filled yet, only valid rows are passed.

        Returns:
            A single sample as list[float], or None if not enough data yet.
        """
        ...

    # Base class hooks
    def _extract_channel_labels(self, info) -> list[str]:
        labels = []
        ch = info.desc().child("channels").child("channel")
        while not ch.empty():
            label = ch.child_value("label")
            if label:
                labels.append(label)
            ch = ch.next_sibling()
        return labels

    def _setup(self):
        print(f"[{self.name}] Resolving source stream '{self.source_name}'...")
        streams = resolve_byprop('name', self.source_name, timeout=5.0)

        if self.source_type:
            streams = [s for s in streams if s.type() == self.source_type]

        if not streams:
            raise RuntimeError(f"No LSL stream found with name '{self.source_name}'")

        info = streams[0]
        self.source_rate = info.nominal_srate()
        source_channels = info.channel_count()
        labels = self._extract_channel_labels(info)
        if len(labels) != source_channels:
            labels = [f"{self.source_name}_ch{i+1}" for i in range(source_channels)]
        self._source_channel_labels = labels

        self._inlet = StreamInlet(info, max_buflen=int(self.buffer_seconds + 1))
        self._inlet.open_stream()

        if self.source_rate > 0:
            buf_len = int(self.source_rate * self.buffer_seconds)
        else:
            # Irregular streams report nominal_srate=0; keep a bounded rolling
            # window based on process cadence so derived sensors still function.
            buf_len = int(self.buffer_seconds / self.process_interval)
        buf_len = max(1, buf_len)
        self._buffer = np.zeros((buf_len, source_channels))
        self._buf_idx = 0
        self._buf_full = False

        print(f"[{self.name}] Connected to '{info.name()}' "
              f"({source_channels}ch @ {self.source_rate}Hz), "
              f"buffer={self.buffer_seconds}s ({buf_len} samples)")

    def _loop_body(self):
        samples, _ = self._inlet.pull_chunk(timeout=self.process_interval)

        if not samples:
            return

        # Fill the rolling buffer with incoming samples
        for sample in samples:
            self._buffer[self._buf_idx] = sample
            self._buf_idx += 1
            if self._buf_idx >= len(self._buffer):
                self._buf_idx = 0
                self._buf_full = True

        # Build the buffer view: oldest first
        if self._buf_full:
            buf = np.roll(self._buffer, -self._buf_idx, axis=0)
        else:
            buf = self._buffer[:self._buf_idx]

        if len(buf) == 0:
            return

        result = self.process(buf)
        if result is not None:
            self.push(result)

    def _teardown(self):
        if self._inlet:
            self._inlet.close_stream()


# ════════════════════════════════════════════════════════════════════
# DUMMY SENSOR - FOR TESTING AND PLACEHOLDING
# ════════════════════════════════════════════════════════════════════
@dataclass
class DummySensor(Sensor):
    """
    Base class for fake/test sensors that generate synthetic data.

    Use this to test your pipeline, build frontend components, or troubleshoot
    without needing real hardware. Subclass this and implement generate_sample()
    to produce whatever fake data you need.

    There is no device to connect to. The sensor just generates data and
    pushes it at the declared sample rate.
    """

    @abstractmethod
    def generate_sample(self) -> list[float]:
        """
        Generate one fake sample.
        Return a list of floats (one per channel).
        This should always return data — dummy sensors never have "no data available".
        """
        ...

    # Base class hooks

    def _setup(self):
        print(f"[{self.name}] Starting dummy sensor...")

    def _loop_body(self):
        sample = self.generate_sample()
        self.push(sample)
        if self.sample_rate > 0:
            time.sleep(1.0 / self.sample_rate)


# ════════════════════════════════════════════════════════════════════
# MACHINE LEARNING SENSOR - DERIVED SENSOR THAT APPLIES A PRE-TRAINED MODEL TO THE BUFFER
# ════════════════════════════════════════════════════════════════════
@dataclass
class MLSensor(DerivedSensor):
    """
    Generic ML-derived LSL sensor.

    Loads a serialized model bundle from a .pkl file, subscribes to an input
    LSL stream, runs inference on the latest sample window, and publishes
    predictions as its own LSL outlet.
    """
    model_path: str = ""
    source_names: list[str] = field(default_factory=list)
    feature_aliases: dict[str, str] = field(default_factory=dict)

    _model: object = field(init=False, default=None)
    _task: str = field(init=False, default="")
    _feature_cols: list[str] = field(init=False, default_factory=list)
    _has_proba: bool = field(init=False, default=False)
    _warned_feature_shape: bool = field(init=False, default=False)
    _warned_feature_mapping: bool = field(init=False, default=False)
    _last_prediction_error: str = field(init=False, default="")
    _multi_source_mode: bool = field(init=False, default=False)
    _inlets_meta: list[dict] = field(init=False, default_factory=list)
    _latest_by_source: dict[str, np.ndarray | None] = field(init=False, default_factory=dict)

    def __post_init__(self):
        if not self.model_path:
            raise ValueError("model_path is required for MLSensor")

        if self.source_names and not self.source_name:
            object.__setattr__(self, 'source_name', self.source_names[0])

        if not self.source_names and self.source_name:
            object.__setattr__(self, 'source_names', [self.source_name])

        aliases = {
            str(k): str(v)
            for k, v in dict(self.feature_aliases or {}).items()
            if str(k).strip() and str(v).strip()
        }
        object.__setattr__(self, 'feature_aliases', aliases)

        # Placeholder until model is loaded and output channels are inferred.
        if self.channels < 1:
            object.__setattr__(self, 'channels', 1)

        super().__post_init__()

    def _resolve_model_path(self) -> str:
        resolved = self.model_path
        if not os.path.isabs(resolved):
            backend_root = os.path.dirname(os.path.dirname(__file__))
            resolved = os.path.normpath(os.path.join(backend_root, resolved))
        if not os.path.exists(resolved):
            raise FileNotFoundError(f"Model file not found: {resolved}")
        return resolved

    def _load_model(self):
        resolved = self._resolve_model_path()
        with open(resolved, "rb") as f:
            bundle = pickle.load(f)

        self._model = bundle["model"]
        self._task = str(bundle.get("task", "regression")).strip().lower()
        self._feature_cols = bundle.get("feature_cols", []) or []
        self._has_proba = (
            self._task == "classification"
            and hasattr(self._model, "predict_proba")
        )

        print(
            f"[{self.name}] Loaded '{self._task}' model "
            f"({len(self._feature_cols)} features) from {resolved}"
        )

    def _setup(self):
        self._load_model()

        # One output for prediction, optional second for confidence.
        n_channels = 2 if self._has_proba else 1
        object.__setattr__(self, 'channels', n_channels)
        labels = ["prediction"] + (["confidence"] if self._has_proba else [])
        object.__setattr__(self, 'channel_labels', labels)

        requested = []
        for name in self.source_names:
            s = str(name).strip()
            if s and s not in requested:
                requested.append(s)

        if len(requested) <= 1:
            object.__setattr__(self, 'source_names', requested or [self.source_name])
            self._multi_source_mode = False
            super()._setup()
            return

        self._multi_source_mode = True
        self._inlets_meta = []
        self._latest_by_source = {}

        print(f"[{self.name}] Resolving source streams: {', '.join(requested)}")

        max_rate = 0.0
        for source in requested:
            streams = resolve_byprop('name', source, timeout=5.0)
            if self.source_type:
                streams = [s for s in streams if s.type() == self.source_type]

            if not streams:
                raise RuntimeError(f"No LSL stream found with name '{source}'")

            info = streams[0]
            inlet = StreamInlet(info, max_buflen=int(self.buffer_seconds + 1))
            inlet.open_stream()

            labels = self._extract_channel_labels(info)
            channels = info.channel_count()
            if len(labels) != channels:
                labels = [f"{source}_ch{i+1}" for i in range(channels)]

            self._inlets_meta.append({
                "name": source,
                "inlet": inlet,
                "channels": channels,
                "labels": labels,
                "rate": float(info.nominal_srate()),
            })
            self._latest_by_source[source] = None
            max_rate = max(max_rate, float(info.nominal_srate()))

            print(
                f"[{self.name}] Connected to '{source}' "
                f"({channels}ch @ {info.nominal_srate()}Hz)"
            )

        object.__setattr__(self, 'source_rate', max_rate)
        object.__setattr__(self, 'source_names', requested)

    def _extract_channel_labels(self, info) -> list[str]:
        return super()._extract_channel_labels(info)

    def _predict_from_features(self, features: np.ndarray) -> list[float] | None:
        vec = np.asarray(features, dtype=float).reshape(-1)

        # Preserve feature names for models/pipelines trained with named columns.
        if self._feature_cols and len(self._feature_cols) == vec.size:
            X = pd.DataFrame([vec], columns=self._feature_cols)
        else:
            X = vec.reshape(1, -1)

        try:
            prediction = float(self._model.predict(X)[0])
            self._last_prediction_error = ""
            if self._has_proba:
                proba = self._model.predict_proba(X)[0]
                confidence = float(np.max(proba))
                return [prediction, confidence]
            return [prediction]
        except Exception as exc:
            msg = str(exc)
            if msg != self._last_prediction_error:
                print(f"[{self.name}] Prediction error: {msg}")
                self._last_prediction_error = msg
            return None

    def _assemble_features(self, values: np.ndarray, label_to_value: dict[str, float]) -> np.ndarray | None:
        n_features = len(self._feature_cols) if self._feature_cols else int(values.size)
        if n_features <= 0:
            return None

        if self._feature_cols:
            assembled = []
            missing = []
            for feature in self._feature_cols:
                lookup = self.feature_aliases.get(feature, feature)
                if lookup in label_to_value:
                    assembled.append(label_to_value[lookup])
                else:
                    missing.append(feature)

            if not missing:
                return np.asarray(assembled, dtype=float)

            if not self._warned_feature_mapping:
                print(
                    f"[{self.name}] Feature labels not fully matched ({len(missing)} missing). "
                    f"Using ordered fallback."
                )
                self._warned_feature_mapping = True

        arr = np.asarray(values, dtype=float)
        if arr.size < n_features:
            return None
        return arr[:n_features]

    def _loop_body(self):
        if not self._multi_source_mode:
            return super()._loop_body()

        saw_new = False
        for meta in self._inlets_meta:
            samples, _ = meta["inlet"].pull_chunk(timeout=0.0)
            if samples:
                self._latest_by_source[meta["name"]] = np.asarray(samples[-1], dtype=float)
                saw_new = True

        if not saw_new:
            time.sleep(self.process_interval)
            return

        latest = []
        labels = []
        label_to_value: dict[str, float] = {}

        for meta in self._inlets_meta:
            sample = self._latest_by_source.get(meta["name"])
            if sample is None:
                return

            channels = int(meta["channels"])
            sample = sample[:channels]
            latest.extend(sample.tolist())

            for idx, value in enumerate(sample.tolist()):
                label = meta["labels"][idx] if idx < len(meta["labels"]) else f"{meta['name']}_ch{idx+1}"
                labels.append(label)
                if label not in label_to_value:
                    label_to_value[label] = float(value)
                prefixed = f"{meta['name']}::{label}"
                if prefixed not in label_to_value:
                    label_to_value[prefixed] = float(value)

        features = self._assemble_features(np.asarray(latest, dtype=float), label_to_value)
        if features is None:
            return

        result = self._predict_from_features(features)
        if result is not None:
            self.push(result)

    def process(self, buffer: np.ndarray) -> list[float] | None:
        if buffer is None or len(buffer) == 0:
            return None

        sample = buffer[-1]
        n_features = len(self._feature_cols) if self._feature_cols else sample.shape[0]

        label_to_value = {
            self._source_channel_labels[idx]: float(sample[idx])
            for idx in range(min(len(self._source_channel_labels), sample.shape[0]))
        }
        for idx, label in enumerate(self._source_channel_labels[:sample.shape[0]]):
            label_to_value[f"{self.source_name}::{label}"] = float(sample[idx])

        # Prefer latest-sample features when dimensions already match.
        if sample.shape[0] >= n_features:
            features = sample[:n_features]
        else:
            # If the model expects more features than a single source sample has,
            # build a feature vector from the rolling buffer (oldest -> newest).
            flat = buffer.reshape(-1)
            if flat.size < n_features:
                if not self._warned_feature_shape:
                    print(
                        f"[{self.name}] Waiting for enough buffered features: "
                        f"need={n_features}, have={flat.size}"
                    )
                    self._warned_feature_shape = True
                return None

            features = flat[-n_features:]
            if not self._warned_feature_shape:
                print(
                    f"[{self.name}] Feature mapping via buffer window: "
                    f"model={n_features}, sample_width={sample.shape[0]}, "
                    f"buffer_values={flat.size}"
                )
                self._warned_feature_shape = True

        features = self._assemble_features(np.asarray(features, dtype=float), label_to_value)
        if features is None:
            return None

        return self._predict_from_features(features)

    def _teardown(self):
        if self._multi_source_mode:
            for meta in self._inlets_meta:
                try:
                    meta["inlet"].close_stream()
                except Exception:
                    pass
            self._inlets_meta = []
            self._latest_by_source = {}
            return
        super()._teardown()

class RegressionSensor(MLSensor):
    """Specialized ML sensor for regression bundles."""

    def _load_model(self):
        super()._load_model()
        if self._task != "regression":
            raise ValueError(f"RegressionSensor requires task='regression', got '{self._task}'")

class ClassificationSensor(MLSensor):
    """Specialized ML sensor for classification bundles."""

    def _load_model(self):
        super()._load_model()
        if self._task != "classification":
            raise ValueError(f"ClassificationSensor requires task='classification', got '{self._task}'")