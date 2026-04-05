"""
Dummy Sensor Template

Copy this file into the dummy/ folder and rename it.
Rename the class, then fill in generate_sample() with your fake data.
"""

from dataclasses import dataclass
from sensors.sensor import DummySensor


@dataclass
class MyDummySensor(DummySensor):  # ← rename this
    """Describe what this sensor fakes."""

    # Add any settings you need (optional)
    # noise_level: float = 0.1

    def generate_sample(self) -> list[float]:
        """
        Return one fake sample as a list of numbers.
        Must have exactly as many values as your 'channels' setting.
        """
        pass  # ← replace with your fake data


# ── To start the sensor ─────────────────────────────────────

if __name__ == "__main__":
    sensor = MyDummySensor(
        uid="",              # ← unique ID for this instance
        name="",             # ← human-readable name
        type="",             # ← signal category: "ECG", "EEG", etc.
        channels=0,          # ← how many numbers per sample
        sample_rate=0,       # ← samples per second (Hz)
    )

    sensor.run()  # starts streaming, blocks until Ctrl+C
