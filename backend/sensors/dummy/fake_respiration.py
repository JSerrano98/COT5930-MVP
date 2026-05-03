from dataclasses import dataclass, field

import numpy as np

from sensors.sensor import DummySensor


@dataclass
class FakeRespiration(DummySensor):
    """Simulate a respiratory belt signal (arbitrary units)."""

    _t: float = 0.0
    _phase: float = 0.0
    _rate_bpm: float = 14.0
    _amp: float = 1.0

    _rng: np.random.Generator = field(init=False, repr=False)

    @classmethod
    def default(cls):
        return cls(
            uid="fake_resp_001",
            name="FakeRespiration",
            type="Respiration",
            channels=1,
            sample_rate=25,
            channel_labels=["resp_belt_au"],
        )

    def __post_init__(self):
        super().__post_init__()
        self._rng = np.random.default_rng(seed=15)

    def generate_sample(self) -> list[float]:
        dt = 1.0 / self.sample_rate
        self._t += dt

        # Respiratory rate and depth drift over time.
        self._rate_bpm += (14.0 - self._rate_bpm) * dt / 45.0
        self._rate_bpm += float(self._rng.normal(0.0, 0.03))
        self._rate_bpm = float(np.clip(self._rate_bpm, 8.0, 24.0))

        self._amp += (1.0 - self._amp) * dt / 25.0
        self._amp += float(self._rng.normal(0.0, 0.004))
        self._amp = float(np.clip(self._amp, 0.6, 1.6))

        freq_hz = self._rate_bpm / 60.0
        self._phase += 2 * np.pi * freq_hz * dt

        # Rounded inhalation / exhalation shape.
        fundamental = np.sin(self._phase)
        harmonic = 0.22 * np.sin(2 * self._phase - 0.4)
        belt = self._amp * (fundamental + harmonic)
        belt += float(self._rng.normal(0.0, 0.03))

        return [belt]


if __name__ == "__main__":
    sensor = FakeRespiration.default()
    sensor.run()
