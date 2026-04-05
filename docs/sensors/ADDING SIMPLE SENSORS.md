# Adding a Sensor to Echo

This guide covers adding **Dummy Sensors** (fake data for testing) and **Derived Sensors** (computed metrics from existing streams). If you need to connect real hardware, see `PHYSICAL_SENSOR_GUIDE.md`.

---

## Where Files Go

```
echo/src/backend/sensors/
├── sensor.py                      ← don't touch this
├── dummy_sensor_template.py       ← copy this for fake/test sensors
├── derived_sensor_template.py     ← copy this for computed metrics
├── physical/
├── derived/                       ← your derived sensors go here
└── dummy/                         ← your dummy sensors go here
```

---

## Dummy Sensors

A dummy sensor generates fake data. Use it to test the pipeline, build frontend components, or troubleshoot without needing real hardware.

### How to add one

1. Copy `dummy_sensor_template.py` into the `dummy/` folder
2. Rename the file and the class to match what you're faking (e.g. `fake_ecg.py`, `class FakeECG`)
3. Fill in `generate_sample()` — return a list of fake numbers, one per channel

### Example — Fake ECG

```python
import random
import numpy as np
from dataclasses import dataclass
from sensors.sensor import DummySensor


@dataclass
class FakeECG(DummySensor):
    """Generates a fake heartbeat-like signal for testing."""

    _t: float = 0.0

    def generate_sample(self) -> list[float]:
        self._t += 1 / self.sample_rate
        beat = np.exp(-((self._t % 0.833 - 0.1) ** 2) / 0.001)
        noise = random.gauss(0, 0.05)
        return [float(beat + noise)]
```

Start it:

```python
ecg = FakeECG(
    uid="fake_ecg_001",
    name="FakeECG",
    type="ECG",
    channels=1,
    sample_rate=250,
)
ecg.start()
```

Now `"FakeECG"` is a real stream on the network. Your FastAPI server, LabRecorder, or any derived sensor can see it and read from it.

---

## Derived Sensors

A derived sensor reads from an existing stream and computes something new. Heart rate from ECG, alpha power from EEG, moving average, whatever math you need. The result becomes its own stream that Echo records alongside the raw data.

### How to add one

1. Copy `derived_sensor_template.py` into the `derived/` folder
2. Rename the file and the class to match your metric (e.g. `heart_rate.py`, `class HeartRate`)
3. Fill in `process(buffer)` — do your math on the buffer and return a list of numbers

### What is the buffer?

The buffer is a grid of recent data from the source sensor. Rows are moments in time (oldest at top, newest at bottom). Columns are channels.

- `buffer[:, 0]` → all samples from channel 1
- `buffer[:, 1]` → all samples from channel 2
- `self.source_rate` → the source sensor's sample rate in Hz

Return a list of numbers (one per output channel), or `None` if there isn't enough data yet.

### Example — Heart Rate from ECG

```python
import numpy as np
from dataclasses import dataclass
from sensors.sensor import DerivedSensor


@dataclass
class HeartRate(DerivedSensor):
    """Computes BPM from a raw ECG stream."""

    threshold: float = 0.6

    def process(self, buffer: np.ndarray) -> list[float] | None:
        ecg = buffer[:, 0]
        ecg = (ecg - ecg.mean()) / (ecg.std() + 1e-8)

        above = ecg > self.threshold
        crossings = np.where(np.diff(above.astype(int)) == 1)[0]

        if len(crossings) < 2:
            return None

        intervals = np.diff(crossings) / self.source_rate
        bpm = 60.0 / intervals.mean()
        return [float(bpm)]
```

Start it (the source sensor must already be running):

```python
hr = HeartRate(
    uid="hr_001",
    name="HeartRate",
    type="HR",
    channels=1,
    sample_rate=1,
    source_name="FakeECG",       # must match the source sensor's name exactly
    buffer_seconds=5.0,
    process_interval=1.0,
)
hr.start()
```

---

## Field Reference

All sensors need these:

| Field | What it is | Example |
|-------|-----------|---------|
| `uid` | Unique ID for this instance | `"hr_001"` |
| `name` | Human-readable label | `"HeartRate"` |
| `type` | Signal category | `"ECG"`, `"HR"`, `"EEG"` |
| `channels` | Numbers per sample | `1`, `4`, `8` |
| `sample_rate` | Samples per second (Hz) | `1`, `100`, `250` |

Derived sensors also need:

| Field | What it is | Example |
|-------|-----------|---------|
| `source_name` | Stream to read from (exact match, case-sensitive) | `"FakeECG"` |
| `buffer_seconds` | Seconds of history to keep | `5.0` |
| `process_interval` | Seconds between each `process()` call | `1.0` |

---

## Common Mistakes

**"No LSL stream found"** — The source sensor isn't running yet, or `source_name` doesn't match exactly. Start the source first. Check capitalization.

**Wrong number of values** — Your function returned a list with a different length than `channels`. They must match exactly.

**Nothing happens** — You forgot to call `.start()`. Creating the object doesn't start streaming.
