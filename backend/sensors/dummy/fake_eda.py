from dataclasses import dataclass, field

import numpy as np

from sensors.sensor import DummySensor


@dataclass
class FakeEDA(DummySensor):
    """Simulate EDA in DEAP raw-ADC units, alternating between class-0 and
    class-1 territory every ~5 s so a logistic-regression model trained on
    s01_cleaned2 (high_arousal) classifies both 0 and 1.

    The logistic model's decision boundary (with other features at their
    training means) is at EDA1 ≈ 2.956e9.
      Class-0 zone: EDA1 < 2.956e9   →  we target ~1.2e9
      Class-1 zone: EDA1 > 2.956e9   →  we target ~4.7e9

    A 10-second square-wave base alternates between the two zones with a
    0.8-s cosine ramp for smooth transitions.  Physiological SCR-like events
    (scaled to DEAP units) are added on top for realistic character.
    """

    _t:      float = 0.0
    _rng:    np.random.Generator = field(init=False, repr=False)
    _events: list  = field(init=False, default_factory=list, repr=False)

    # Alternation parameters
    _PERIOD:    float = 10.0    # s — full cycle (5 s each class)
    _LOW:       float = 1.2e9   # deep class-0 value
    _HIGH:      float = 4.7e9   # deep class-1 value
    _RAMP:      float = 0.8     # s — cosine transition width

    # Physiological noise (SCR events, scaled to DEAP units)
    _SCR_RATE:  float = 2.5     # events / min
    _SCR_MIN:   float = 0.25e9
    _SCR_MAX:   float = 0.90e9
    _NOISE:     float = 20e6    # white noise std

    @classmethod
    def default(cls):
        return cls(
            uid="fake_eda_001",
            name="FakeEDA",
            type="EDA",
            channels=1,
            sample_rate=32,
            channel_labels=["EDA1"],
        )

    def __post_init__(self):
        super().__post_init__()
        self._rng = np.random.default_rng(seed=24)

    def _square_wave_base(self, t: float) -> float:
        """Square wave with cosine ramps between _LOW and _HIGH."""
        phase = (t % self._PERIOD) / self._PERIOD  # 0..1
        half = 0.5
        ramp = self._RAMP / self._PERIOD

        if phase < half - ramp / 2:
            return self._LOW
        elif phase < half + ramp / 2:
            # ramp LOW → HIGH
            alpha = (phase - (half - ramp / 2)) / ramp
            return self._LOW + (self._HIGH - self._LOW) * 0.5 * (1 - np.cos(np.pi * alpha))
        elif phase < 1.0 - ramp / 2:
            return self._HIGH
        else:
            # ramp HIGH → LOW
            alpha = (phase - (1.0 - ramp / 2)) / ramp
            return self._HIGH + (self._LOW - self._HIGH) * 0.5 * (1 - np.cos(np.pi * alpha))

    def generate_sample(self) -> list[float]:
        dt = 1.0 / self.sample_rate
        self._t += dt

        base = self._square_wave_base(self._t)

        # SCR-like events on top
        if self._rng.random() < (self._SCR_RATE / 60.0) * dt:
            amp = float(self._rng.uniform(self._SCR_MIN, self._SCR_MAX))
            self._events.append((self._t, amp))

        phasic: float = 0.0
        active = []
        for t0, amp in self._events:
            x = self._t - t0
            if x <= 0:
                active.append((t0, amp))
                continue
            if x > 12.0:
                continue
            r = amp * (np.exp(-x / 2.8) - np.exp(-x / 0.8))
            if r > 0:
                phasic += float(r)
            active.append((t0, amp))
        self._events = active

        value = base + phasic + float(self._rng.normal(0.0, self._NOISE))
        return [max(0.0, value)]


if __name__ == "__main__":
    sensor = FakeEDA.default()
    sensor.run()
