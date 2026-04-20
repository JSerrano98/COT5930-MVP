import time
from dataclasses import dataclass, field
from sensors.sensor import DummySensor

SAMPLE_RATE = 250    # Hz
PERIOD_S    = 5.0    # seconds between pulses


@dataclass
class TimerSignal(DummySensor):
    """
    Outputs 0 continuously. Every 5 real seconds fires exactly one sample of 1,
    then returns to 0. Pulse timing is wall-clock based so it never drifts.
    """

    _last_pulse: float = field(default_factory=time.time)

    @classmethod
    def default(cls):
        return cls(
            uid="timer_001",
            name="TIMER",
            type="Dummy",
            channels=1,
            sample_rate=SAMPLE_RATE,
        )

    def generate_sample(self) -> list[float]:
        now = time.time()
        if now - self._last_pulse >= PERIOD_S:
            self._last_pulse = now
            return [1.0]
        return [0.0]


if __name__ == "__main__":
    sensor = TimerSignal.default()
    sensor.run()
