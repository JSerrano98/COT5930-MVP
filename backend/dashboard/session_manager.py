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
        self.clients = []  # list[WebSocket]
        self._task: asyncio.Task | None = None
        self.update_rate = 120.  # Hz

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

    def start(self):
        """Discover streams and begin the broadcast loop."""
        self.inlets = self._discover_streams()
        max_rate = max((s["rate"] for s in self.inlets), default=120)
        if max_rate > 120:
            log.warning(f"Max stream rate is {max_rate}")
            self.update_rate = max_rate  # Match the fastest stream if it's above default
        self._task = asyncio.create_task(self._read_lsl_loop())
        self.status = "Online"
        log.info(f"Session started... {len(self.inlets)} stream(s) discovered")

    async def stop(self):
        """Cancel the broadcast loop and close all inlets."""
        if self._task:
            self._task.cancel()
            self._task = None

        for stream in self.inlets:
            try:
                stream["inlet"].close_stream()
            except Exception:
                pass

        self.inlets = []
        self.status = "Offline"
        log.info("Session stopped")

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

            result.append({
                "name": info.name(),
                "type": info.type(),
                "channels": info.channel_count(),
                "rate": info.nominal_srate(),
                "channel_labels": channel_labels,
                "inlet": inlet,
            })
            log.info(f"  SIG: {info.name()} | {info.type()} | {info.channel_count()}ch @ {info.nominal_srate()}Hz")
            log.info(f"       Labels: {channel_labels}")

        return result

    def refresh(self) -> list[dict]:
        """
        Re-scan the network for LSL streams.
        Closes existing inlets and creates new ones for any currently available streams.
        """
        self.status = "Refreshing"
        log.info("Refreshing streams...")

        for stream in self.inlets:
            try:
                stream["inlet"].close_stream()
            except Exception:
                pass

        self.inlets = self._discover_streams(timeout=3.0)
        self.status = "Online"
        return self.list_streams()

    def list_streams(self) -> list[dict]:
        """
        Return metadata for all discovered streams (no inlet objects).
        """
        return [
            {
                "name": s["name"],
                "type": s["type"],
                "channels": s["channels"],
                "rate": s["rate"],
                "channel_labels": s["channel_labels"],
            }
            for s in self.inlets
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
            for stream in self.inlets:
                inlet: StreamInlet = stream["inlet"]

                sample, timestamp = inlet.pull_sample(timeout=0.0)
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