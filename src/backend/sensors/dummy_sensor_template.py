"""
Dummy Sensor Template

Copy this file into the dummy/ folder and rename it.
Rename the class, then fill in generate_sample() with your fake data.
"""

import time
from dataclasses import dataclass
from sensors.sensor import DummySensor


@dataclass
class MyDummySensor(DummySensor):  # ← rename MyDummySensor to something descriptive
    """Describe what this sensor fakes."""

    # Add any settings you need (optional)
    # noise_level: float = 0.1

    def generate_sample(self) -> list[float]:
        """
        Return one fake sample as a list of numbers.
        Must have exactly as many values as your 'channels' setting.
        """
        pass  # ← replace with your fake data

    # ── Don't touch below this line ──────────────────────────

    def _setup(self):
        print(f"[{self.name}] Starting dummy sensor...")

    def _loop_body(self):
        sample = self.generate_sample()
        self.push(sample)
        if self.sample_rate > 0:
            time.sleep(1.0 / self.sample_rate)


# ── To start the sensor ─────────────────────────────────────
#
#   sensor = MyDummySensor(
#       uid="",
#       name="",
#       type="",
#       channels=0,
#       sample_rate=0,
#   )
#   sensor.start()
