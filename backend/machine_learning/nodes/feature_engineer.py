"""
Feature Engineering node — windowed feature extraction.
"""

import numpy as np
import pandas as pd
from scipy.stats import skew, kurtosis


# ── Individual feature functions ──────────────────────────────────────────────

def _zero_crossings(x: np.ndarray) -> float:
    return float(np.sum(np.diff(np.sign(x)) != 0))

def _rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x ** 2)))

def _band_power(x: np.ndarray, low: float, high: float, fs: float) -> float:
    freqs = np.fft.rfftfreq(len(x), d=1.0 / fs)
    psd   = np.abs(np.fft.rfft(x)) ** 2
    mask  = (freqs >= low) & (freqs <= high)
    return float(np.trapezoid(psd[mask], freqs[mask])) if mask.any() else 0.0

def _spectral_entropy(x: np.ndarray) -> float:
    psd  = np.abs(np.fft.rfft(x)) ** 2
    psd  = psd / (psd.sum() + 1e-12)
    return float(-np.sum(psd * np.log2(psd + 1e-12)))

BANDS = {
    "delta": (0.5, 4),
    "theta": (4,   8),
    "alpha": (8,  13),
    "beta":  (13, 30),
    "gamma": (30, 100),
}

FEATURE_FNS = {
    "mean":             lambda x, fs: float(np.mean(x)),
    "std":              lambda x, fs: float(np.std(x)),
    "variance":         lambda x, fs: float(np.var(x)),
    "skewness":         lambda x, fs: float(skew(x)),
    "kurtosis":         lambda x, fs: float(kurtosis(x)),
    "rms":              lambda x, fs: _rms(x),
    "peak_to_peak":     lambda x, fs: float(np.max(x) - np.min(x)),
    "zero_crossings":   lambda x, fs: _zero_crossings(x),
    "fft_power":        lambda x, fs: float(np.sum(np.abs(np.fft.rfft(x)) ** 2)),
    "dominant_freq":    lambda x, fs: float(np.fft.rfftfreq(len(x), 1 / fs)[np.argmax(np.abs(np.fft.rfft(x)))]),
    "spectral_entropy": lambda x, fs: _spectral_entropy(x),
    "band_power_delta": lambda x, fs: _band_power(x, *BANDS["delta"], fs),
    "band_power_theta": lambda x, fs: _band_power(x, *BANDS["theta"], fs),
    "band_power_alpha": lambda x, fs: _band_power(x, *BANDS["alpha"], fs),
    "band_power_beta":  lambda x, fs: _band_power(x, *BANDS["beta"],  fs),
    "band_power_gamma": lambda x, fs: _band_power(x, *BANDS["gamma"], fs),
    # Nonlinear (lightweight approximations)
    "hjorth_mobility":    lambda x, fs: float(np.std(np.diff(x)) / (np.std(x) + 1e-12)),
    "hjorth_complexity":  lambda x, fs: float((np.std(np.diff(np.diff(x))) / (np.std(np.diff(x)) + 1e-12)) / (np.std(np.diff(x)) / (np.std(x) + 1e-12) + 1e-12)),
    "sample_entropy":     lambda x, fs: _approx_entropy(x),
    "approximate_entropy":lambda x, fs: _approx_entropy(x),
}


def _approx_entropy(x: np.ndarray, m: int = 2, r_frac: float = 0.2) -> float:
    """Lightweight approximate entropy (O(N²) — only run on small windows)."""
    N = len(x)
    if N < m + 2:
        return 0.0
    r = r_frac * float(np.std(x))
    def phi(m_):
        templates = np.array([x[i:i + m_] for i in range(N - m_ + 1)])
        count = np.sum(np.max(np.abs(templates[:, None] - templates[None, :]), axis=2) <= r, axis=0)
        return np.mean(np.log(count / (N - m_ + 1) + 1e-12))
    return float(abs(phi(m) - phi(m + 1)))


# ── Windowing ─────────────────────────────────────────────────────────────────

def extract_windows(df: pd.DataFrame, label_col: str | None, window: int, step: int,
                    feature_names: list[str], fs: float) -> pd.DataFrame:
    """Slide a window over all numeric columns and compute features per window."""
    num_cols = [c for c in df.select_dtypes(include=[np.number]).columns if c != label_col]

    rows = []
    for start in range(0, len(df) - window + 1, step):
        chunk  = df.iloc[start:start + window]
        row    = {}
        for col in num_cols:
            sig = chunk[col].values
            for fn in feature_names:
                if fn in FEATURE_FNS:
                    row[f"{col}__{fn}"] = FEATURE_FNS[fn](sig, fs)
        if label_col and label_col in df.columns:
            # Majority vote for the label in this window
            row[label_col] = chunk[label_col].mode().iloc[0]
        rows.append(row)

    return pd.DataFrame(rows) if rows else pd.DataFrame()


# ── Node entry-point ──────────────────────────────────────────────────────────

def run(config: dict, upstream):
    if upstream is None:
        raise ValueError("FeatureEngineer requires upstream data.")

    features    = config.get("features",   ["mean", "std", "band_power_alpha"])
    window_size = int(config.get("windowSize", 256))
    overlap     = float(config.get("overlap",  0.5))
    fs          = float(config.get("fs",       256))
    label_col   = upstream[1]

    # Find label column heuristically if not specified

    print('feature')
    print(config)
    print(upstream)
    print(label_col)
    if not label_col:
        for c in upstream.columns:
            if c.lower() in ("label", "class", "target", "y"):
                label_col = c
                break

    step = max(1, int(window_size * (1 - overlap)))
    feature_df = extract_windows(upstream[0], label_col, window_size, step, features, fs)

    if feature_df.empty:
        raise ValueError("FeatureEngineer: no windows could be extracted — check window size vs. data length.")

    result = {
        "feature_count": len([c for c in feature_df.columns if c != label_col]),
        "windows":       len(feature_df),
        "features":      features,
    }
    print(feature_df)
    return result, [feature_df, label_col]
