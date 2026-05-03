from dataclasses import dataclass, field

import numpy as np

from sensors.sensor import DummySensor


@dataclass
class FakeTemperature(DummySensor):
    """Simulate body temperature in degrees Celsius."""

    _t: float = 0.0
    _temp_c: float = 36.9

    _rng: np.random.Generator = field(init=False, repr=False)

    @classmethod
    def default(cls):
        return cls(
            uid="fake_temp_001",
            name="FakeTemperature",
            type="Temperature",
            channels=1,
            sample_rate=1,
            channel_labels=["temp_c"],
        )

    def __post_init__(self):
        super().__post_init__()
        self._rng = np.random.default_rng(seed=7)

    def generate_sample(self) -> list[float]:
        dt = 1.0 / self.sample_rate
        self._t += dt

        circadian_like = 0.18 * np.sin(2 * np.pi * self._t / 480.0)
        target = 36.9 + circadian_like

        self._temp_c += (target - self._temp_c) * dt / 120.0
        self._temp_c += float(self._rng.normal(0.0, 0.01))
        self._temp_c = float(np.clip(self._temp_c, 35.5, 38.4))

        return [self._temp_c]


if __name__ == "__main__":
    sensor = FakeTemperature.default()
    sensor.run()
