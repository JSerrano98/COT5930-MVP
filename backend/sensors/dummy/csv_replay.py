from __future__ import annotations

import os
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from sensors.sensor import DummySensor


@dataclass
class CSVReplaySensor(DummySensor):
    """Replay numeric CSV rows as an LSL stream."""

    csv_path: str = ""
    timestamp_column: str = "timestamp"
    loop: bool = False
    use_csv_timing: bool = True
    time_scale: float = 1.0
    on_complete: Callable[[], None] | None = field(default=None, repr=False, compare=False)

    _rows: list[list[float]] = field(init=False, default_factory=list)
    _timestamps: list[float] = field(init=False, default_factory=list)
    _row_idx: int = field(init=False, default=0)
    _last_timestamp: float | None = field(init=False, default=None)
    _resolved_csv_path: Path | None = field(init=False, default=None)
    _reported_eof: bool = field(init=False, default=False)
    _completed: bool = field(init=False, default=False)

    def __post_init__(self):
        super().__post_init__()
        if not self.csv_path:
            raise ValueError("csv_path is required for CSVReplaySensor")
        if self.time_scale <= 0:
            raise ValueError("time_scale must be > 0")

    @staticmethod
    def _backend_root() -> Path:
        return Path(__file__).resolve().parents[2]

    @classmethod
    def _resolve_csv_path(cls, csv_path: str) -> Path:
        candidate = Path(csv_path)
        if candidate.is_absolute():
            return candidate
        return cls._backend_root() / candidate

    @staticmethod
    def _parse_bool(value: str | None, default: bool) -> bool:
        if value is None:
            return default
        return value.strip().lower() in {"1", "true", "yes", "on"}

    @classmethod
    def _infer_channel_labels(
        cls,
        csv_path: Path,
        timestamp_column: str,
        requested_labels: list[str] | None,
    ) -> list[str]:
        df = pd.read_csv(csv_path, nrows=32)
        if requested_labels:
            missing = [label for label in requested_labels if label not in df.columns]
            if missing:
                raise ValueError(
                    f"Requested replay columns not found in {csv_path.name}: {', '.join(missing)}"
                )
            return requested_labels

        labels = [
            col
            for col in df.columns
            if col != timestamp_column and pd.api.types.is_numeric_dtype(df[col])
        ]
        if not labels:
            raise ValueError(
                f"No numeric replay columns found in {csv_path.name} excluding '{timestamp_column}'"
            )
        return labels

    @classmethod
    def describe_csv(
        cls,
        csv_path: str,
        timestamp_column: str = "timestamp",
        requested_labels: list[str] | None = None,
    ) -> dict:
        resolved = cls._resolve_csv_path(csv_path)
        if not resolved.exists():
            raise FileNotFoundError(f"Replay CSV not found: {resolved}")

        labels = cls._infer_channel_labels(resolved, timestamp_column, requested_labels)
        df = pd.read_csv(resolved)
        if df.empty:
            raise ValueError(f"Replay CSV is empty: {resolved}")

        duration_seconds = None
        if timestamp_column in df.columns:
            ts = pd.to_numeric(df[timestamp_column], errors="coerce")
            if ts.notna().all() and len(ts) >= 2:
                duration_seconds = float(ts.iloc[-1] - ts.iloc[0])

        return {
            "path": str(resolved),
            "file_name": resolved.name,
            "timestamp_column": timestamp_column,
            "rows": int(len(df)),
            "channel_labels": labels,
            "channels": len(labels),
            "columns": list(df.columns),
            "duration_seconds": duration_seconds,
        }

    @classmethod
    def default(cls):
        env_path = os.getenv("ECHO_REPLAY_CSV", "data/CSV/replay_sample.csv")
        timestamp_column = os.getenv("ECHO_REPLAY_TIMESTAMP_COLUMN", "timestamp")
        requested_columns = os.getenv("ECHO_REPLAY_COLUMNS", "").strip()
        requested_labels = [
            col.strip() for col in requested_columns.split(",") if col.strip()
        ] or None
        resolved = cls._resolve_csv_path(env_path)
        labels = cls._infer_channel_labels(resolved, timestamp_column, requested_labels)

        use_csv_timing = cls._parse_bool(os.getenv("ECHO_REPLAY_USE_CSV_TIMING"), True)
        fallback_rate = float(os.getenv("ECHO_REPLAY_SAMPLE_RATE", "1.0"))
        sample_rate = 0.0 if use_csv_timing else fallback_rate

        return cls(
            uid=os.getenv("ECHO_REPLAY_UID", "csv_replay_001"),
            name=os.getenv("ECHO_REPLAY_NAME", "CSVReplay"),
            type=os.getenv("ECHO_REPLAY_TYPE", "Replay"),
            channels=len(labels),
            sample_rate=sample_rate,
            channel_labels=labels,
            csv_path=str(resolved),
            timestamp_column=timestamp_column,
            loop=cls._parse_bool(os.getenv("ECHO_REPLAY_LOOP"), False),
            use_csv_timing=use_csv_timing,
            time_scale=float(os.getenv("ECHO_REPLAY_TIME_SCALE", "1.0")),
        )

    def _setup(self):
        super()._setup()
        self._resolved_csv_path = self._resolve_csv_path(self.csv_path)
        if not self._resolved_csv_path.exists():
            raise FileNotFoundError(f"Replay CSV not found: {self._resolved_csv_path}")

        df = pd.read_csv(self._resolved_csv_path)
        if df.empty:
            raise ValueError(f"Replay CSV is empty: {self._resolved_csv_path}")

        missing = [label for label in self.channel_labels if label not in df.columns]
        if missing:
            raise ValueError(
                f"Replay columns missing from {self._resolved_csv_path.name}: {', '.join(missing)}"
            )

        frame = df[self.channel_labels].apply(pd.to_numeric, errors="coerce")
        if frame.isna().any().any():
            bad_columns = frame.columns[frame.isna().any()].tolist()
            raise ValueError(
                f"Replay columns contain non-numeric values: {', '.join(bad_columns)}"
            )

        self._rows = frame.astype(float).values.tolist()
        self._timestamps = []
        if self.use_csv_timing and self.timestamp_column in df.columns:
            self._timestamps = pd.to_numeric(df[self.timestamp_column], errors="coerce").tolist()
            if any(pd.isna(ts) for ts in self._timestamps):
                raise ValueError(
                    f"Timestamp column '{self.timestamp_column}' contains non-numeric values"
                )

        self._row_idx = 0
        self._last_timestamp = None
        self._reported_eof = False
        self._completed = False

        print(
            f"[{self.name}] Loaded {len(self._rows)} rows from {self._resolved_csv_path.name} "
            f"({len(self.channel_labels)} channel(s))"
        )

    def generate_sample(self) -> list[float]:
        if not self._rows:
            raise RuntimeError("Replay CSV not loaded; call start() before generate_sample().")
        idx = min(self._row_idx, len(self._rows) - 1)
        return list(self._rows[idx])

    def _sleep_for_timing(self):
        if self._timestamps:
            current = self._timestamps[self._row_idx]
            if self._last_timestamp is not None:
                delay = max(0.0, (current - self._last_timestamp) * self.time_scale)
                if delay > 0:
                    time.sleep(delay)
            self._last_timestamp = current
            return

        if self.sample_rate > 0 and self._row_idx > 0:
            time.sleep(1.0 / self.sample_rate)

    def _loop_body(self):
        if self._row_idx >= len(self._rows):
            if self.loop:
                self._row_idx = 0
                self._last_timestamp = None
                return
            if not self._reported_eof:
                print(f"[{self.name}] Reached end of replay CSV; stopping stream.")
                self._reported_eof = True
            self._completed = True
            self._running = False
            if self.on_complete is not None:
                try:
                    self.on_complete()
                except Exception as exc:
                    print(f"[{self.name}] on_complete callback failed: {exc}")
            return

        self._sleep_for_timing()
        self.push(self._rows[self._row_idx])
        self._row_idx += 1


if __name__ == "__main__":
    sensor = CSVReplaySensor.default()
    sensor.run()