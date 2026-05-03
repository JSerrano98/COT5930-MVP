"""
Session Manager:
Manages LSL stream discovery, WebSocket client broadcasting,
and optional recording (CSV or Excel). Instantiated by the FastAPI app.
"""
import asyncio
import csv
import json
import logging
import openpyxl
import struct
import threading
import time

from pylsl import StreamInlet, resolve_streams
from pathlib import Path
from datetime import datetime

log = logging.getLogger(__name__)


class _XDFWriter:
    """
    Minimal XDF 1.0 writer (https://github.com/sccn/xdf/wiki/Specifications).
    Buffers all samples in memory and writes the complete file on save().
    Channel values are stored as float32.
    """
    _MAGIC = b'XDF:\x01\xff'

    def __init__(self, streams: list[dict]):
        self._stream_ids: dict[str, int] = {}
        self._stream_infos: dict[str, dict] = {}
        self._buffers: dict[str, list] = {}  # name maps to [(ts, [values])]
        self._header = bytearray(self._MAGIC)
        self._header += self._make_chunk(
            1, b'<?xml version="1.0"?><info><version>1.0</version></info>'
        )
        for i, s in enumerate(streams, start=1):
            self._stream_ids[s['name']] = i
            self._stream_infos[s['name']] = s
            self._buffers[s['name']] = []
            self._header += self._make_chunk(2, self._stream_header_bytes(i, s))

    def add_sample(self, stream_name: str, timestamp: float, values: list):
        if stream_name in self._buffers:
            self._buffers[stream_name].append((timestamp, list(values)))

    def save(self, path: Path):
        buf = bytearray(self._header)
        for name, samples in self._buffers.items():
            if not samples:
                continue
            sid = self._stream_ids[name]
            n_ch = self._stream_infos[name]['channels']
            sample_bytes = bytearray()
            for ts, vals in samples:
                sample_bytes += struct.pack('B', 8)       # timestamp_bytes = 8
                sample_bytes += struct.pack('<d', ts)     # timestamp (double)
                for ci in range(n_ch):
                    v = vals[ci] if ci < len(vals) else 0.0
                    sample_bytes += struct.pack('<f', float(v))
            buf += self._make_chunk(3, struct.pack('<I', sid) + bytes(sample_bytes))
            first_ts, last_ts = samples[0][0], samples[-1][0]
            footer = (
                f'<?xml version="1.0"?><info>'
                f'<first_timestamp>{first_ts}</first_timestamp>'
                f'<last_timestamp>{last_ts}</last_timestamp>'
                f'<sample_count>{len(samples)}</sample_count>'
                f'<measured_srate>0</measured_srate></info>'
            )
            buf += self._make_chunk(6, struct.pack('<I', sid) + footer.encode())
        path.write_bytes(bytes(buf))

    @staticmethod
    def _encode_varlen(n: int) -> bytes:
        if n <= 0xFF:
            return struct.pack('BB', 1, n)
        if n <= 0xFFFFFFFF:
            return struct.pack('<BI', 4, n)
        return struct.pack('<BQ', 8, n)

    def _make_chunk(self, tag: int, content: bytes) -> bytes:
        body = struct.pack('<H', tag) + content
        return self._encode_varlen(len(body)) + body

    @staticmethod
    def _stream_header_bytes(sid: int, s: dict) -> bytes:
        ch_xml = ''.join(
            f'<channel><label>{lbl}</label>'
            f'<type>{s["type"]}</type>'
            f'<unit>unknown</unit></channel>'
            for lbl in s['channel_labels']
        )
        xml = (
            f'<?xml version="1.0"?><info>'
            f'<name>{s["name"]}</name>'
            f'<type>{s["type"]}</type>'
            f'<channel_count>{s["channels"]}</channel_count>'
            f'<nominal_srate>{s["rate"]}</nominal_srate>'
            f'<channel_format>float32</channel_format>'
            f'<source_id>{s["name"]}</source_id>'
            f'<desc><channels>{ch_xml}</channels></desc>'
            f'</info>'
        )
        return struct.pack('<I', sid) + xml.encode()


class SessionManager:
    def __init__(self):
        self.status = "Offline"
        self.inlets: list[dict] = []
        self._inlets_lock = threading.RLock()
        self.clients = []  # list[WebSocket]
        self._task: asyncio.Task | None = None
        self.update_rate = 120.  # Hz
        self._auto_discovery_interval = 5.0
        self._discovery_thread: threading.Thread | None = None
        self._discovery_stop = threading.Event()

        self._recording = False
        self._record_fmt: str = "csv"
        self._record_path: Path | None = None
        self._wb: openpyxl.Workbook | None = None
        self._wb_sheet = None
        self._csv_file = None
        self._csv_writer = None
        self._xdf: _XDFWriter | None = None
        self._col_map: dict[str, int] = {}
        self._col_headers: list[str] = []

    def _auto_discovery_worker(self):
        """Background thread: periodically discover new LSL streams without blocking the event loop."""
        while not self._discovery_stop.wait(timeout=self._auto_discovery_interval):
            try:
                self._discover_new_streams_non_disruptive(timeout=0.5)
            except Exception as exc:
                log.debug(f"Auto-discovery tick failed: {exc}")

    def start(self):
        """Discover streams and begin the broadcast loop."""
        discovered = self._discover_streams()
        with self._inlets_lock:
            self.inlets = discovered
        self._task = asyncio.create_task(self._read_lsl_loop())
        self._discovery_stop.clear()
        self._discovery_thread = threading.Thread(
            target=self._auto_discovery_worker, daemon=True, name="lsl-auto-discovery"
        )
        self._discovery_thread.start()
        self.status = "Online"
        log.info(f"Session started... {len(self.inlets)} stream(s) discovered")

    async def stop(self):
        """Cancel the broadcast loop and close all inlets."""
        self._discovery_stop.set()
        if self._discovery_thread and self._discovery_thread.is_alive():
            self._discovery_thread.join(timeout=2.0)
        self._discovery_thread = None
        if self._task:
            self._task.cancel()
            self._task = None

        with self._inlets_lock:
            streams_to_close = list(self.inlets)
            self.inlets = []

        for stream in streams_to_close:
            try:
                stream["inlet"].close_stream()
            except Exception:
                pass
        self.status = "Offline"
        log.info("Session stopped")

    @staticmethod
    def _stream_key(name: str, type_: str, channels: int, source_id: str) -> tuple[str, str, int, str]:
        return (str(name), str(type_), int(channels), str(source_id or ""))

    def _open_inlet_from_info(self, info) -> dict:
        inlet = StreamInlet(info, max_buflen=1)
        inlet.open_stream()

        try:
            full_info = inlet.info(timeout=3.0)
        except Exception:
            full_info = info

        channel_labels = []
        ch = full_info.desc().child("channels").child("channel")
        while not ch.empty():
            label = ch.child_value("label")
            if label:
                channel_labels.append(label)
            ch = ch.next_sibling()

        if len(channel_labels) != info.channel_count():
            channel_labels = [f"Channel {i+1}" for i in range(info.channel_count())]

        source_id = ""
        try:
            source_id = info.source_id() or ""
        except Exception:
            source_id = ""

        return {
            "name": info.name(),
            "type": info.type(),
            "channels": info.channel_count(),
            "rate": info.nominal_srate(),
            "channel_labels": channel_labels,
            "source_id": source_id,
            "stream_key": self._stream_key(info.name(), info.type(), info.channel_count(), source_id),
            "inlet": inlet,
        }

    def _discover_streams(self, timeout: float = 3.0) -> list[dict]:
        """
        Find all LSL outlets on the network and create an inlet for each.
        Args:
            timeout (float): How long to wait for streams to appear in seconds.
        Returns:
            List of dicts containing stream metadata and inlet object.
        """
        log.info(f"Scanning for streams ({timeout}s)...")
        found = resolve_streams(timeout)
        log.info(f"Found {len(found)} stream(s)")

        result = []
        for info in found:
            result.append(self._open_inlet_from_info(info))
            log.info(f"  SIG: {info.name()} | {info.type()} | {info.channel_count()}ch @ {info.nominal_srate()}Hz")
            log.info(f"       Labels: {result[-1]['channel_labels']}")

        return result

    def refresh(self) -> list[dict]:
        """
        Re-scan the network for LSL streams.
        Closes existing inlets and creates new ones for any currently available streams.
        """
        self.status = "Refreshing"
        log.info("Refreshing streams...")

        found = resolve_streams(3.0)

        existing_by_key = {}
        with self._inlets_lock:
            for s in self.inlets:
                key = s.get("stream_key")
                if key is None:
                    key = self._stream_key(s["name"], s["type"], s["channels"], s.get("source_id", ""))
                    s["stream_key"] = key
                existing_by_key[key] = s

        found_info_by_key = {}
        for info in found:
            source_id = ""
            try:
                source_id = info.source_id() or ""
            except Exception:
                source_id = ""
            key = self._stream_key(info.name(), info.type(), info.channel_count(), source_id)
            if key not in found_info_by_key:
                found_info_by_key[key] = info

        keys_existing = set(existing_by_key.keys())
        keys_found = set(found_info_by_key.keys())

        keys_to_remove = keys_existing - keys_found
        keys_to_add = keys_found - keys_existing

        stale_streams = [existing_by_key[k] for k in keys_to_remove]
        new_streams = []
        for key in keys_to_add:
            info = found_info_by_key[key]
            try:
                new_stream = self._open_inlet_from_info(info)
                new_streams.append(new_stream)
                log.info(
                    f"  SIG: {new_stream['name']} | {new_stream['type']} | "
                    f"{new_stream['channels']}ch @ {new_stream['rate']}Hz"
                )
                log.info(f"       Labels: {new_stream['channel_labels']}")
            except Exception as exc:
                log.warning(f"Failed opening inlet for stream '{info.name()}': {exc}")

        for stream in stale_streams:
            try:
                stream["inlet"].close_stream()
            except Exception:
                pass

        with self._inlets_lock:
            kept_streams = [s for s in self.inlets if s.get("stream_key") not in keys_to_remove]
            self.inlets = kept_streams + new_streams

        log.info(f"Found {len(self.inlets)} stream(s)")
        self.status = "Online"
        return self.list_streams()

    def _discover_new_streams_non_disruptive(self, timeout: float = 0.2) -> int:
        """
        Discover and attach newly appeared streams without removing existing inlets.
        Returns the number of newly attached streams.
        """
        found = resolve_streams(timeout)

        with self._inlets_lock:
            existing_keys = set()
            for s in self.inlets:
                key = s.get("stream_key")
                if key is None:
                    key = self._stream_key(s["name"], s["type"], s["channels"], s.get("source_id", ""))
                    s["stream_key"] = key
                existing_keys.add(key)

        to_add = []
        seen = set()
        for info in found:
            source_id = ""
            try:
                source_id = info.source_id() or ""
            except Exception:
                source_id = ""
            key = self._stream_key(info.name(), info.type(), info.channel_count(), source_id)
            if key in existing_keys or key in seen:
                continue
            seen.add(key)
            to_add.append(info)

        added = 0
        for info in to_add:
            try:
                stream = self._open_inlet_from_info(info)
            except Exception as exc:
                log.debug(f"Auto-discovery failed for '{info.name()}': {exc}")
                continue

            with self._inlets_lock:
                if any(s.get("stream_key") == stream.get("stream_key") for s in self.inlets):
                    try:
                        stream["inlet"].close_stream()
                    except Exception:
                        pass
                    continue
                self.inlets.append(stream)

            added += 1
            log.info(
                f"Auto-attached stream: {stream['name']} | {stream['type']} | "
                f"{stream['channels']}ch @ {stream['rate']}Hz"
            )

        return added

    def attach_stream(self, name: str, stream_type: str | None = None, timeout: float = 2.0, replace_same_name: bool = False) -> bool:
        """
        Attach a single stream inlet by name to the active session without a full refresh.
        Returns True if a new inlet was added, False if no matching stream was found or it already exists.
        """
        stream_name = str(name).strip()
        if not stream_name:
            return False

        found = resolve_streams(timeout)
        matches = [s for s in found if s.name() == stream_name]
        if stream_type:
            matches = [s for s in matches if s.type() == stream_type]
        if not matches:
            return False

        info = matches[0]
        source_id = ""
        try:
            source_id = info.source_id() or ""
        except Exception:
            source_id = ""
        new_key = self._stream_key(info.name(), info.type(), info.channel_count(), source_id)

        with self._inlets_lock:
            if any(s.get("stream_key") == new_key for s in self.inlets):
                return False

            stale_same_name = []
            if replace_same_name:
                stale_same_name = [
                    s for s in self.inlets
                    if s.get("name") == stream_name and (not stream_type or s.get("type") == stream_type)
                ]
                if stale_same_name:
                    self.inlets = [s for s in self.inlets if s not in stale_same_name]

        for stream in stale_same_name:
            try:
                stream["inlet"].close_stream()
            except Exception:
                pass

        try:
            new_stream = self._open_inlet_from_info(info)
        except Exception as exc:
            log.warning(f"Failed attaching stream '{stream_name}': {exc}")
            return False

        with self._inlets_lock:
            if any(s.get("stream_key") == new_stream.get("stream_key") for s in self.inlets):
                try:
                    new_stream["inlet"].close_stream()
                except Exception:
                    pass
                return False
            self.inlets.append(new_stream)

        log.info(
            f"Attached stream: {new_stream['name']} | {new_stream['type']} | "
            f"{new_stream['channels']}ch @ {new_stream['rate']}Hz"
        )
        return True

    def detach_stream(self, name: str, stream_type: str | None = None) -> int:
        """
        Detach stream inlet(s) by name (and optional type) from the active session.
        Returns the number of removed inlets.
        """
        stream_name = str(name).strip()
        if not stream_name:
            return 0

        with self._inlets_lock:
            to_remove = [
                s for s in self.inlets
                if s.get("name") == stream_name and (not stream_type or s.get("type") == stream_type)
            ]
            if not to_remove:
                return 0
            self.inlets = [s for s in self.inlets if s not in to_remove]

        for stream in to_remove:
            try:
                stream["inlet"].close_stream()
            except Exception:
                pass

        log.info(f"Detached {len(to_remove)} stream(s) named '{stream_name}'")
        return len(to_remove)

    def list_streams(self) -> list[dict]:
        """
        Return metadata for all discovered streams (no inlet objects).
        """
        with self._inlets_lock:
            snapshot = list(self.inlets)

        return [
            {
                "name": s["name"],
                "type": s["type"],
                "channels": s["channels"],
                "rate": s["rate"],
                "channel_labels": s["channel_labels"],
            }
            for s in snapshot
        ]

    async def add_client(self, ws):
        """
        Register a new WebSocket client.
        """
        self.clients.append(ws)
        log.info(f"Client connected ({len(self.clients)} total)")

    def remove_client(self, ws):
        """
        Unregister a WebSocket client.
        """
        if ws in self.clients:
            self.clients.remove(ws)
        log.info(f"Client disconnected ({len(self.clients)} total)")

    async def _read_lsl_loop(self):
        while True:
            with self._inlets_lock:
                streams_snapshot = list(self.inlets)

            for stream in streams_snapshot:
                inlet: StreamInlet = stream["inlet"]

                try:
                    sample, timestamp = inlet.pull_sample(timeout=0.0)
                except Exception as exc:
                    log.debug(f"pull_sample failed for {stream.get('name', 'unknown')}: {exc}")
                    continue
                if sample is not None:
                    if self._recording:
                        self._record_sample(timestamp, stream["name"], sample)

                    payload = json.dumps({
                        "stream": stream["name"],
                        "type": stream["type"],
                        "timestamp": timestamp,
                        "data": sample,
                    })

                    disconnected = []
                    for ws in self.clients:
                        try:
                            await ws.send_text(payload)
                        except Exception:
                            disconnected.append(ws)
                    for ws in disconnected:
                        self.clients.remove(ws)

            await asyncio.sleep(1.0 / self.update_rate)

    def _default_recordings_dir(self) -> Path:
        """Returns (and creates) the default recordings folder next to this package."""
        p = Path(__file__).resolve().parent.parent / "recordings"
        p.mkdir(parents=True, exist_ok=True)
        return p

    def start_recording(self, file_path: str | None = None, fmt: str = "csv"):
        if self._recording:
            return

        fmt = fmt.lower().strip()
        if fmt not in ("csv", "xlsx", "xdf"):
            fmt = "csv"

        ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        ext = ".xlsx" if fmt == "xlsx" else ".xdf" if fmt == "xdf" else ".csv"

        if file_path:
            dest = Path(file_path)
            if dest.is_dir() or not dest.suffix:
                dest = dest / f"recording_{ts}{ext}"
        else:
            dest = self._default_recordings_dir() / f"recording_{ts}{ext}"

        dest.parent.mkdir(parents=True, exist_ok=True)
        self._record_path = dest
        self._record_fmt = fmt

        self._col_map = {}
        self._col_headers = []
        col_idx = 0
        for s in self.inlets:
            self._col_map[s["name"]] = col_idx
            for lbl in s["channel_labels"]:
                self._col_headers.append(lbl)
            col_idx += s["channels"]

        headers = ["timestamp"] + self._col_headers

        if fmt == "xlsx":
            self._wb = openpyxl.Workbook()
            ws = self._wb.active
            self._wb_sheet = ws
            ws.append(headers)
        elif fmt == "xdf":
            self._xdf = _XDFWriter(self.list_streams())
        else:
            self._csv_file = open(dest, "w", newline="", encoding="utf-8")
            self._csv_writer = csv.writer(self._csv_file)
            self._csv_writer.writerow(headers)

        self._recording = True
        log.info(f"Recording started → {dest} ({fmt})")

    def stop_recording(self) -> str | None:
        if not self._recording:
            return None

        self._recording = False
        saved = str(self._record_path) if self._record_path else None

        if self._record_fmt == "xlsx" and self._wb:
            try:
                self._wb.save(self._record_path)
            except Exception as e:
                log.error(f"Failed to save xlsx: {e}")
            self._wb = None
            self._wb_sheet = None
        elif self._record_fmt == "xdf" and self._xdf:
            try:
                self._xdf.save(self._record_path)
            except Exception as e:
                log.error(f"Failed to save xdf: {e}")
            self._xdf = None
        elif self._csv_file:
            try:
                self._csv_file.close()
            except Exception:
                pass
            self._csv_file = None
            self._csv_writer = None

        self._record_path = None
        log.info(f"Recording stopped. Saved to: {saved}")
        return saved

    def _record_sample(self, timestamp: float, stream_name: str, sample: list):
        if not self._recording:
            return
        if self._record_fmt == "xdf" and self._xdf:
            self._xdf.add_sample(stream_name, timestamp, sample)
            return

        n_cols = len(self._col_headers)
        row = [""] * (n_cols + 1)
        row[0] = timestamp
        col_start = self._col_map.get(stream_name)
        if col_start is not None:
            for i, val in enumerate(sample):
                if col_start + i < n_cols:
                    row[col_start + i + 1] = val

        if self._record_fmt == "xlsx" and self._wb_sheet:
            self._wb_sheet.append(row)
        elif self._csv_writer:
            self._csv_writer.writerow(row)