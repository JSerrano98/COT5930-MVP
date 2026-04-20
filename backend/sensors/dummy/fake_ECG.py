from dataclasses import dataclass
from sensors.sensor import DummySensor

import random
import numpy as np

@dataclass
class FakeECG(DummySensor):
    """Generates a fake heartbeat-like signal for testing."""

    _clock: float = 0.0

    @classmethod
    def default(cls):
        return cls(
            uid="fake_ecg_001",
            name="FakeECG",
            type="ECG",
            channels=1,
            sample_rate=250,
        )

    def generate_sample(self) -> list[float]:
        self._clock += 1 / self.sample_rate
        beat = np.exp(-((self._clock % 0.833 - 0.1) ** 2) / 0.001)
        noise = random.gauss(0, 0.05)
        return [float(beat + noise)]

if __name__ == "__main__":
    ecg = FakeECG.default()
    ecg.run()
