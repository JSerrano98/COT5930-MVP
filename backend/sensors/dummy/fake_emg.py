from dataclasses import dataclass, field

import numpy as np

from sensors.sensor import DummySensor


@dataclass
class FakeEMG(DummySensor):
    """Simulate surface EMG in microvolts (uV) with burst-like activations."""

    _t: float = 0.0
    _activation: float = 0.03
    _target_activation: float = 0.03
    _state_time_left: float = 0.0

    _rng: np.random.Generator = field(init=False, repr=False)
    _phases: np.ndarray = field(init=False, repr=False)
    _freqs: np.ndarray = field(init=False, repr=False)

    @classmethod
    def default(cls):
        return cls(
            uid="fake_emg_001",
            name="FakeEMG",
            type="EMG",
            channels=1,
            sample_rate=500,
            channel_labels=["emg_uV"],
        )

    def __post_init__(self):
        super().__post_init__()
        self._rng = np.random.default_rng(seed=91)
        self._freqs = np.array([42.0, 68.0, 96.0, 128.0, 154.0], dtype=float)
        self._phases = self._rng.uniform(0.0, 2 * np.pi, size=len(self._freqs))

    def _step_activation_state(self, dt: float):
        self._state_time_left -= dt
        if self._state_time_left > 0:
            return

        if self._target_activation > 0.12:
            self._target_activation = float(self._rng.uniform(0.02, 0.08))
            self._state_time_left = float(self._rng.uniform(1.5, 4.5))
        else:
            self._target_activation = float(self._rng.uniform(0.25, 0.95))
            self._state_time_left = float(self._rng.uniform(0.35, 1.6))

    def generate_sample(self) -> list[float]:
        dt = 1.0 / self.sample_rate
        self._t += dt

        self._step_activation_state(dt)
        self._activation += (self._target_activation - self._activation) * dt / 0.12
        activation = float(np.clip(self._activation, 0.0, 1.0))

        carrier = float(np.sum(np.sin(2 * np.pi * self._freqs * self._t + self._phases)))
        carrier /= len(self._freqs)

        baseline_noise = float(self._rng.normal(0.0, 2.0))
        active_noise = float(self._rng.normal(0.0, 12.0 * activation))
        signal = baseline_noise + (40.0 * activation * carrier) + active_noise

        return [signal]


if __name__ == "__main__":
    sensor = FakeEMG.default()
    sensor.run()