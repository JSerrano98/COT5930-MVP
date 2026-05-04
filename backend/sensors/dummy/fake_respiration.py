from dataclasses import dataclass, field

import numpy as np

from sensors.sensor import DummySensor


@dataclass
class FakeRespiration(DummySensor):
    """Simulate RESP in DEAP raw-ADC units, in phase with FakeEDA so both
    sensors reinforce the same class prediction.

    DEAP RESP training stats:
      Class-0: mean ≈ +15 614   (higher positive values)
      Class-1: mean ≈  -5 836   (lower / negative values)

    RESP coefficient in the logistic model is −1.76, so lower RESP → more
    class-1.  This sensor uses the same 10-second square-wave base as
    FakeEDA (180° phase offset so RESP is low when EDA is high), with the
    original physiological breathing oscillation (~14 bpm) on top.
    """

    _t:     float = 0.0
    _phase: float = 0.0
    _rng:   np.random.Generator = field(init=False, repr=False)

    # Square-wave base (mirrors FakeEDA period, 180° offset)
    _PERIOD: float = 10.0    # s — must match FakeEDA
    _LOW:    float = -12_000  # class-1 territory (low RESP)
    _HIGH:   float = +22_000  # class-0 territory (high RESP)
    _RAMP:   float = 0.8      # s — cosine ramp width

    # Physiological breathing on top
    _BREATH_AMP:  float = 7_000.0   # breathing swing (DEAP units)
    _RATE_BPM:    float = 14.0
    _NOISE:       float = 500.0

    @classmethod
    def default(cls):
        return cls(
            uid="fake_resp_001",
            name="FakeRespiration",
            type="Respiration",
            channels=1,
            sample_rate=25,
            channel_labels=["RESP"],
        )

    def __post_init__(self):
        super().__post_init__()
        self._rng = np.random.default_rng(seed=15)

    def _square_wave_base(self, t: float) -> float:
        """Same square wave as FakeEDA but 180° offset (half period shifted)."""
        phase = ((t + self._PERIOD / 2) % self._PERIOD) / self._PERIOD
        half = 0.5
        ramp = self._RAMP / self._PERIOD

        if phase < half - ramp / 2:
            return self._LOW
        elif phase < half + ramp / 2:
            alpha = (phase - (half - ramp / 2)) / ramp
            return self._LOW + (self._HIGH - self._LOW) * 0.5 * (1 - np.cos(np.pi * alpha))
        elif phase < 1.0 - ramp / 2:
            return self._HIGH
        else:
            alpha = (phase - (1.0 - ramp / 2)) / ramp
            return self._HIGH + (self._LOW - self._HIGH) * 0.5 * (1 - np.cos(np.pi * alpha))

    def generate_sample(self) -> list[float]:
        dt = 1.0 / self.sample_rate
        self._t    += dt
        self._phase += 2 * np.pi * (self._RATE_BPM / 60.0) * dt

        base = self._square_wave_base(self._t)

        # Physiological breathing (fundamental + harmonic) — old behaviour
        breathing = self._BREATH_AMP * (
            np.sin(self._phase) + 0.22 * np.sin(2 * self._phase - 0.4)
        )

        value = base + breathing + float(self._rng.normal(0.0, self._NOISE))
        return [float(value)]


if __name__ == "__main__":
    sensor = FakeRespiration.default()
    sensor.run()
