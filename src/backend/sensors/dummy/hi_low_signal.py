"""
Dummy Sensor Template

Copy this file into the dummy/ folder and rename it.
Rename the class, then fill in generate_sample() with your fake data.
"""

from dataclasses import dataclass
from sensors.sensor import DummySensor


@dataclass
class HiLowSensor(DummySensor):  # ← rename this
    """
    Oscillates between two values to create a "hi/low" signal for testing.
     - This is a simple example of a dummy sensor that generates a square wave.
     - You can customize the pattern, add noise, or make it more complex as needed.
    """
       
    _clock: int = 0

    def generate_sample(self) -> list[float]:
        """
        Return one fake sample as a list of numbers.
        Must have exactly as many values as your 'channels' setting.
        """
        if self._clock == 0:
            self._clock = 1
            return [1.0]  # "HI" value
        else:
            self._clock = 0
            return [0.0]  # "LOW" value

if __name__ == "__main__":
    sensor = HiLowSensor(
        uid="hi_low_001",              # ← unique ID for this instance
        name="HI_LOW",             # ← human-readable name
        type="Dummy",             # ← signal category: "ECG", "EEG", etc.
        channels=1,          # ← how many numbers per sample
        sample_rate=200,       # ← samples per second (Hz)
    )

    sensor.run()  # starts streaming, blocks until Ctrl+C
