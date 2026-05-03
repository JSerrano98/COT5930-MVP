"""
Alpha Band Power Sensor

Computes the average power in the alpha band (8-12 Hz) for each channel
of a source EEG stream.  Outputs one value per source channel representing
the log-scaled alpha power in that channel.

Requires a running LSL stream of type "EEG" as its source.
"""

import numpy as np
from scipy.signal import welch
from dataclasses import dataclass
from sensors.sensor import DerivedSensor


@dataclass
class AlphaBandPower(DerivedSensor):
    """
    Computes alpha-band (8-12 Hz) power from a source EEG stream.

    Uses Welch's method to estimate PSD on the rolling buffer, then
    integrates power within the alpha range for each channel.  Output
    is log10(power) in µV²/Hz (one value per source channel).

    The sensor enforces that its source must be an EEG-type stream.
    If no EEG stream is found on the network, startup will fail with
    a clear error message.
    """

    alpha_low:  float = 8.0
    alpha_high: float = 12.0

    source_type: str = "EEG"

    def __post_init__(self):
        super().__post_init__()

        if self.source_type != "EEG":
            raise ValueError(
                f"AlphaBandPower requires source_type='EEG', "
                f"got '{self.source_type}'. "
                f"Alpha band power can only be derived from an EEG signal."
            )

    def _setup(self):
        """
        Resolve the source stream with an extra guard:
        if no EEG stream is broadcasting, give a human-friendly error.
        """
        try:
            super()._setup()
        except RuntimeError:
            raise RuntimeError(
                f"[{self.name}] No EEG stream found (looked for name='{self.source_name}', type='EEG'). "
                f"An EEG sensor must be running before alpha band power can start."
            )

    def process(self, buffer: np.ndarray) -> list[float] | None:
        n_samples, n_channels = buffer.shape

        if n_samples < self.source_rate:
            return None

        results = []
        for ch in range(n_channels):
            signal = buffer[:, ch]

            nperseg = min(int(self.source_rate), n_samples)
            freqs, psd = welch(signal, fs=self.source_rate, nperseg=nperseg)

            alpha_mask = (freqs >= self.alpha_low) & (freqs <= self.alpha_high)
            alpha_power = np.trapz(psd[alpha_mask], freqs[alpha_mask])

            results.append(float(np.log10(max(alpha_power, 1e-12))))

        return results


if __name__ == "__main__":
    sensor = AlphaBandPower(
        uid="alpha_power_001",
        name="AlphaPower",
        type="EEG_Alpha",
        channels=8,              # must match source EEG channel count
        sample_rate=1,           # output 1 update per second
        source_name="FakeEEG",   # must match source sensor's name exactly
        source_type="EEG",       # enforced - source must be EEG
        buffer_seconds=2.0,      # 2s window for PSD
        process_interval=1.0,    # recompute every second
    )
    sensor.run()