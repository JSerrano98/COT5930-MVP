"""
Derived Sensor Template

Copy this file into the derived/ folder and rename it.
Rename the class, then fill in process() with your computation.
"""

import numpy as np
from dataclasses import dataclass
from sensors.sensor import DerivedSensor


@dataclass
class MyDerivedSensor(DerivedSensor):  # ← rename this
    """Describe what this computes."""

    # Add any settings for your computation (optional)
    # threshold: float = 0.6

    def process(self, buffer: np.ndarray) -> list[float] | None:
        """
        Do your math on the buffer and return a list of numbers.

        buffer rows = samples over time (oldest first)
        buffer columns = channels from the source sensor
          buffer[:, 0]  → first channel
          buffer[:, 1]  → second channel
          self.source_rate → source sample rate in Hz

        Return a list with exactly 'channels' values, or None if
        not enough data yet.
        """
        pass  # ← replace with your computation


# ── To start the sensor (source must be running first) ──────
#
#   sensor = MyDerivedSensor(
#       uid="",
#       name="",
#       type="",
#       channels=0,
#       sample_rate=0,
#       source_name="",          ← must match source sensor's name exactly
#       buffer_seconds=5.0,
#       process_interval=1.0,
#   )
#   sensor.start()
