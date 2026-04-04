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
import logging
import numpy as np
from pylsl import StreamInfo, StreamOutlet, StreamInlet, resolve_stream
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

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

        if self.sample_rate < 1: # <- TODO: Ask Dr.Vogl pref on bare min sample rate
            raise ValueError("Sample Rate must be at least 1") 

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
            self.uid,
            self.name,
            self.type,
            self.channels,
            self.sample_rate,
            self.channel_format,
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

    def push(self, sample: list[float]):
        """Push a single sample to the outlet."""
        if self._outlet:
            self._outlet.push_sample(sample)

# ════════════════════════════════════════════════════════════════════
# PHYSICAL SENSOR - FOR UNSUPPORTED DEVICES THAT REQUIRE A DRIVER/SDK/API CONNECTION
# ════════════════════════════════════════════════════════════════════

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
    Base class for derived sensors that compute metrics from one or more raw sensor streams.

    Subclass this and implement the process method to create a new derived metric.
    The processor maintains a rolling buffer of incoming samples from the source stream.
    Every process_interval seconds, it calls your process() with the current buffer.

    Your process() returns either:
      - a single sample: list[float]         → pushed as one sample
      - None                                 → nothing to push yet
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
    def _setup(self):
        print(f"[{self.name}] Resolving source stream '{self.source_name}'...")
        streams = resolve_stream('name', self.source_name)

        if self.source_type:
            streams = [s for s in streams if s.type() == self.source_type]

        if not streams:
            raise RuntimeError(f"No LSL stream found with name '{self.source_name}'")

        info = streams[0]
        self.source_rate = info.nominal_srate()
        source_channels = info.channel_count()

        self._inlet = StreamInlet(info, max_buflen=int(self.buffer_seconds + 1))
        self._inlet.open_stream()

        buf_len = int(self.source_rate * self.buffer_seconds)
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