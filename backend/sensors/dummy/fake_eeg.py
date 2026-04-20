"""
Dummy EEG Sensor — Full Research-Grade 64-Channel Simulation

Simulates a 64-channel research EEG (BioSemi 64-channel / 10-10 montage) at
512 Hz with physiologically plausible characteristics:

  - Five frequency bands: delta (0.5-4 Hz), theta (4-8 Hz), alpha (8-13 Hz),
    beta (13-30 Hz), gamma (30-80 Hz).
  - Regionally-differentiated amplitudes:
      * Frontal  : elevated delta/theta (sleep pressure, working memory)
      * Occipital: dominant alpha (eyes-closed resting state)
      * Central  : mu rhythm (8-12 Hz, motor cortex idle)
      * Parietal : moderate alpha/beta
      * Temporal : theta emphasis (hippocampal-linked)
  - 1/f (pink) noise background per channel, approximated with an IIR filter.
  - Spatially correlated activity via a lightweight distance-weighted mixing
    step so adjacent electrodes share common source variance.
  - Per-channel random phase offsets so channels are not perfectly synchronous.
  - Mild 60 Hz line-noise artifact (configurable amplitude).
  - Gaussian white noise floor to simulate amplifier/quantisation noise.

All amplitude values are in µV, consistent with typical scalp EEG recordings.
"""

import numpy as np
from dataclasses import dataclass, field
from sensors.sensor import DummySensor

# ---------------------------------------------------------------------------
# Full BioSemi 64-channel 10-10 montage
# ---------------------------------------------------------------------------
EEG_CHANNELS = [
    # Prefrontal / frontal-polar
    "Fp1", "AF7", "AF3", "F1",  "F3",  "F5",  "F7",
    # Frontal-central
    "FT7", "FC5", "FC3", "FC1",
    # Central
    "C1",  "C3",  "C5",  "T7",
    # Temporal-parietal / parietal
    "TP7", "CP5", "CP3", "CP1",
    "P1",  "P3",  "P5",  "P7",  "P9",
    # Parietal-occipital / occipital (left)
    "PO7", "PO3", "O1",
    # Midline bottom-up
    "Iz",  "Oz",  "POz", "Pz",  "CPz",
    # Prefrontal / frontal-polar (right + midline)
    "Fpz", "Fp2", "AF8", "AF4", "AFz", "Fz",
    # Frontal (right)
    "F2",  "F4",  "F6",  "F8",
    # Frontal-central (right)
    "FT8", "FC6", "FC4", "FC2", "FCz",
    # Central (right + midline)
    "Cz",  "C2",  "C4",  "C6",  "T8",
    # Temporal-parietal / parietal (right)
    "TP8", "CP6", "CP4", "CP2",
    "P2",  "P4",  "P6",  "P8",  "P10",
    # Parietal-occipital / occipital (right)
    "PO8", "PO4", "O2",
]

assert len(EEG_CHANNELS) == 64, f"Expected 64 channels, got {len(EEG_CHANNELS)}"

# ---------------------------------------------------------------------------
# Region tags — used to assign physiology-appropriate band amplitudes
# ---------------------------------------------------------------------------
_FRONTAL    = {"Fp1","Fp2","Fpz","AF3","AF4","AF7","AF8","AFz",
               "F1","F2","F3","F4","F5","F6","F7","F8","Fz"}
_TEMPORAL   = {"FT7","FT8","T7","T8","TP7","TP8"}
_CENTRAL    = {"FC1","FC2","FC3","FC4","FC5","FC6","FCz",
               "C1","C2","C3","C4","C5","C6","Cz",
               "CP1","CP2","CP3","CP4","CP5","CP6","CPz"}
_PARIETAL   = {"P1","P2","P3","P4","P5","P6","P7","P8","P9","P10","Pz",
               "PO3","PO4","PO7","PO8","POz"}
_OCCIPITAL  = {"O1","O2","Oz","Iz"}


def _region_amps(label: str) -> dict:
    """Return per-band amplitude scalers (µV) for a given electrode label."""
    if label in _FRONTAL:
        return dict(delta=25.0, theta=15.0, alpha=8.0,  beta=6.0,  gamma=2.0)
    if label in _TEMPORAL:
        return dict(delta=15.0, theta=20.0, alpha=10.0, beta=5.0,  gamma=1.5)
    if label in _CENTRAL:
        # Central channels carry the mu (motor) rhythm in the alpha band
        return dict(delta=12.0, theta=8.0,  alpha=18.0, beta=7.0,  gamma=2.5)
    if label in _PARIETAL:
        return dict(delta=10.0, theta=10.0, alpha=20.0, beta=8.0,  gamma=2.0)
    if label in _OCCIPITAL:
        # Strongest alpha during eyes-closed rest
        return dict(delta=8.0,  theta=8.0,  alpha=45.0, beta=5.0,  gamma=1.5)
    # Default / midline
    return dict(delta=15.0, theta=10.0, alpha=15.0, beta=6.0, gamma=2.0)


# ---------------------------------------------------------------------------
# Pink (1/f) noise IIR approximation coefficients
# Voss-McCartney method: sum of white-noise octave generators
# ---------------------------------------------------------------------------
_PINK_STAGES = 8          # number of octave generators
_PINK_SCALE  = 2.0        # µV scale for background pink noise


@dataclass
class _PinkNoise:
    """Lightweight per-channel 1/f noise generator (Voss-McCartney)."""
    rng: np.random.Generator
    _rows: np.ndarray = field(init=False)
    _running_sum: float = field(init=False, default=0.0)
    _count: int = field(init=False, default=0)

    def __post_init__(self):
        self._rows = self.rng.standard_normal(_PINK_STAGES)
        self._running_sum = float(self._rows.sum())

    def next(self) -> float:
        self._count += 1
        # Determine which stages to update (trailing zeros of count)
        idx = int(np.log2(self._count & -self._count)) if self._count else 0
        idx = min(idx, _PINK_STAGES - 1)
        prev = self._rows[idx]
        self._rows[idx] = self.rng.standard_normal()
        self._running_sum += self._rows[idx] - prev
        # Mix in white noise for highest-frequency component
        white = self.rng.standard_normal()
        return (self._running_sum + white) * _PINK_SCALE / _PINK_STAGES


# ---------------------------------------------------------------------------
# Spatial correlation weight matrix (simple distance proxy on channel index)
# ---------------------------------------------------------------------------
def _build_spatial_weights(n: int, sigma: float = 4.0) -> np.ndarray:
    """
    Gaussian-decaying neighbour weights for an n-channel linear index.
    Each row sums to 1.0 so the mixing preserves mean amplitude.
    This is a crude approximation of volume conduction.
    """
    idx = np.arange(n, dtype=float)
    d   = np.abs(idx[:, None] - idx[None, :])
    W   = np.exp(-(d ** 2) / (2 * sigma ** 2))
    W  /= W.sum(axis=1, keepdims=True)
    return W.astype(np.float32)


# ---------------------------------------------------------------------------
# Main sensor class
# ---------------------------------------------------------------------------
@dataclass
class FakeEEG(DummySensor):
    """
    Full 64-channel research-grade EEG simulator.

    Produces physiologically plausible multi-channel EEG at 512 Hz using:
      - Five oscillatory bands with region-specific amplitudes
      - 1/f (pink) background noise per channel
      - Gaussian white noise floor (amplifier noise)
      - Spatial correlation via Gaussian-weighted neighbour mixing
      - 60 Hz line-noise artifact
      - Independent random phase offsets per channel and band
    """

    noise_floor:  float = 0.3   # µV white noise (amplifier floor)
    line_noise:   float = 0.5   # µV amplitude of 60 Hz artifact

    _t:           float = field(init=False, default=0.0)
    _phases:      np.ndarray = field(init=False)   # (n_ch, n_bands) phase offsets
    _region_amps: list       = field(init=False)   # list of per-channel amp dicts
    _pink:        list       = field(init=False)   # list of _PinkNoise generators
    _W:           np.ndarray = field(init=False)   # spatial weight matrix

    # Representative centre frequencies for each band (Hz)
    _BAND_FREQS = dict(delta=2.0, theta=6.0, alpha=10.5, beta=20.0, gamma=40.0)

    @classmethod
    def default(cls):
        return cls(
            uid="fake_eeg_001",
            name="FakeEEG",
            type="EEG",
            channels=len(EEG_CHANNELS),
            sample_rate=512,
            channel_labels=EEG_CHANNELS,
        )

    def __post_init__(self):
        super().__post_init__()
        n = len(EEG_CHANNELS)
        rng = np.random.default_rng(seed=42)

        # Random phase offsets: shape (n_channels, n_bands)
        self._phases = rng.uniform(0, 2 * np.pi, size=(n, len(self._BAND_FREQS)))

        # Per-channel amplitude dictionaries
        self._region_amps = [_region_amps(lbl) for lbl in EEG_CHANNELS]

        # Per-channel pink noise generators
        self._pink = [
            _PinkNoise(rng=np.random.default_rng(seed=i)) for i in range(n)
        ]

        # Spatial mixing matrix
        self._W = _build_spatial_weights(n, sigma=4.0)

    def generate_sample(self) -> list[float]:
        self._t += 1.0 / self.sample_rate
        t = self._t
        n = len(EEG_CHANNELS)
        bands = list(self._BAND_FREQS.items())  # [(name, freq), ...]

        # 1. Generate independent signal per channel
        raw = np.empty(n)
        for i in range(n):
            amps = self._region_amps[i]
            sig  = 0.0
            for b_idx, (band_name, freq) in enumerate(bands):
                sig += amps[band_name] * np.sin(
                    2 * np.pi * freq * t + self._phases[i, b_idx]
                )
            # 60 Hz line noise
            sig += self.line_noise * np.sin(2 * np.pi * 60.0 * t)
            # 1/f background
            sig += self._pink[i].next()
            # White noise floor
            sig += float(np.random.normal(0.0, self.noise_floor))
            raw[i] = sig

        # 2. Apply spatial (volume conduction) mixing
        mixed = self._W @ raw

        return mixed.tolist()


if __name__ == "__main__":
    eeg = FakeEEG.default()
    eeg.run()
