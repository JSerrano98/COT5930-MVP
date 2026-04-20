"""
Preprocessor node — scaling, filtering, NaN handling.
"""

import numpy as np
import pandas as pd
from scipy.signal import butter, filtfilt, iirnotch


def _bandpass(data: np.ndarray, low: float, high: float, fs: float, order: int = 4) -> np.ndarray:
    nyq  = 0.5 * fs
    low  = max(low  / nyq, 1e-6)
    high = min(high / nyq, 1 - 1e-6)
    b, a = butter(order, [low, high], btype="band")
    return filtfilt(b, a, data, axis=0)


def _lowpass(data: np.ndarray, cutoff: float, fs: float, order: int = 4) -> np.ndarray:
    nyq  = 0.5 * fs
    cut  = min(cutoff / nyq, 1 - 1e-6)
    b, a = butter(order, cut, btype="low")
    return filtfilt(b, a, data, axis=0)


def _highpass(data: np.ndarray, cutoff: float, fs: float, order: int = 4) -> np.ndarray:
    nyq  = 0.5 * fs
    cut  = max(cutoff / nyq, 1e-6)
    b, a = butter(order, cut, btype="high")
    return filtfilt(b, a, data, axis=0)


def _notch(data: np.ndarray, freq: float, fs: float, Q: float = 30.0) -> np.ndarray:
    w0   = freq / (0.5 * fs)
    b, a = iirnotch(w0, Q)
    return filtfilt(b, a, data, axis=0)


def run(config: dict, upstream):
    """
    config keys:
        scaler   : 'none' | 'standard' | 'minmax' | 'robust'
        filter   : 'none' | 'bandpass' | 'lowpass' | 'highpass' | 'notch'
        lowFreq  : float  (bandpass / highpass cutoff)
        highFreq : float  (bandpass / lowpass cutoff)
        notchHz  : float  (notch frequency)
        dropNa   : bool
    """
    if upstream is None:
        raise ValueError("Preprocessor requires upstream data.")

    df     = upstream.copy()
    scaler = config.get("scaler",  "standard")
    filt   = config.get("filter",  "none")
    dropna = config.get("dropNa",  True)

    # Drop NaN
    if dropna:
        df = df.dropna()

    # Identify numeric (feature) columns — skip string/object columns
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    arr      = df[num_cols].values.astype(float)

    # ── Scaling ──────────────────────────────────────────────────────
    if scaler == "standard":
        mean = arr.mean(axis=0)
        std  = arr.std(axis=0)
        std[std == 0] = 1
        arr = (arr - mean) / std

    elif scaler == "minmax":
        mn  = arr.min(axis=0)
        mx  = arr.max(axis=0)
        rng = mx - mn
        rng[rng == 0] = 1
        arr = (arr - mn) / rng

    elif scaler == "robust":
        from numpy import median, percentile
        med  = median(arr, axis=0)
        iqr  = percentile(arr, 75, axis=0) - percentile(arr, 25, axis=0)
        iqr[iqr == 0] = 1
        arr  = (arr - med) / iqr

    # ── Filtering ─────────────────────────────────────────────────────
    # Assume ~256 Hz if not provided; real pipelines should pass fs
    fs       = float(config.get("fs", 256))
    low_hz   = float(config.get("lowFreq",  1))
    high_hz  = float(config.get("highFreq", 50))
    notch_hz = float(config.get("notchHz",  60))

    if filt == "bandpass" and arr.shape[0] > 10:
        arr = _bandpass(arr, low_hz, high_hz, fs)
    elif filt == "lowpass" and arr.shape[0] > 10:
        arr = _lowpass(arr, high_hz, fs)
    elif filt == "highpass" and arr.shape[0] > 10:
        arr = _highpass(arr, low_hz, fs)
    elif filt == "notch" and arr.shape[0] > 10:
        arr = _notch(arr, notch_hz, fs)

    df[num_cols] = arr

    result = {"rows": len(df), "cols": len(df.columns), "scaler": scaler, "filter": filt}
    return result, df
