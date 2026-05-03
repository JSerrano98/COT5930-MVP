from dataclasses import dataclass, field

import numpy as np

from sensors.sensor import DummySensor


@dataclass
class FakeEDA(DummySensor):
    """Simulate electrodermal activity in microSiemens (uS)."""

    tonic_uS: float = 4.5

    _t: float = 0.0
    _rng: np.random.Generator = field(init=False, repr=False)
    _events: list[tuple[float, float]] = field(init=False, default_factory=list, repr=False)

    @classmethod
    def default(cls):
        return cls(
            uid="fake_eda_001",
            name="FakeEDA",
            type="EDA",
            channels=1,
            sample_rate=32,
            channel_labels=["eda_uS"],
        )

    def __post_init__(self):
        super().__post_init__()
        self._rng = np.random.default_rng(seed=24)

    def _scr_event_probability(self, dt: float) -> float:
        target_per_min = 2.5 + 0.8 * np.sin(2 * np.pi * self._t / 120.0)
        return max(0.0, target_per_min / 60.0) * dt

    def generate_sample(self) -> list[float]:
        dt = 1.0 / self.sample_rate
        self._t += dt

        tonic_target = 4.2 + 0.4 * np.sin(2 * np.pi * self._t / 180.0)
        self.tonic_uS += (tonic_target - self.tonic_uS) * dt / 35.0
        self.tonic_uS += float(self._rng.normal(0.0, 0.0015))

        if self._rng.random() < self._scr_event_probability(dt):
            amp = float(self._rng.uniform(0.05, 0.45))
            self._events.append((self._t, amp))

        phasic = 0.0
        active_events: list[tuple[float, float]] = []
        for t0, amp in self._events:
            x = self._t - t0
            if x <= 0:
                active_events.append((t0, amp))
                continue
            if x > 12.0:
                continue
            tau_rise = 0.8
            tau_decay = 2.8
            response = amp * (np.exp(-x / tau_decay) - np.exp(-x / tau_rise))
            if response > 0:
                phasic += float(response)
            active_events.append((t0, amp))
        self._events = active_events

        value = self.tonic_uS + phasic + float(self._rng.normal(0.0, 0.005))
        return [max(0.02, value)]


if __name__ == "__main__":
    sensor = FakeEDA.default()
    sensor.run()