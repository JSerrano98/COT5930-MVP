"""
Session Manager:
Manages LSL stream discovery, WebSocket client broadcasting,
and optional Excel recording. Instantiated by the FastAPI app.
"""
import asyncio
import json
import logging
import openpyxl

from pylsl import StreamInlet, resolve_streams
from pathlib import Path

log = logging.getLogger(__name__)

class SessionManager:
    def __init__(self):
        self.status = "Offline"
        self.inlets: list[dict] = []
        self.clients = []  # list[WebSocket]
        self._task: asyncio.Task | None = None
        self.update_rate = 120.  # Hz

        # Recording
        self._recording = False
        self._wb = openpyxl.Workbook()
        self._wb.active.append(["TimeStamp", "StreamName", "Data"])

    # ════════════════════════════════════════════════════════════════
    # SESSION LIFECYCLE
    # ════════════════════════════════════════════════════════════════
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

    # ════════════════════════════════════════════════════════════════
    # STREAM DISCOVERY
    # ════════════════════════════════════════════════════════════════
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

            # inlet.info() fetches the full stream description from the publisher,
            # including channel labels written by the sensor. The StreamInfo from
            # resolve_streams() only carries basic metadata without the desc tree.
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

    # ════════════════════════════════════════════════════════════════
    # WEBSOCKET BROADCAST
    # ════════════════════════════════════════════════════════════════
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
                        self._excel_payload(timestamp, stream["name"], sample[0])

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

    # ════════════════════════════════════════════════════════════════
    # RECORDING
    # ════════════════════════════════════════════════════════════════
    def start_recording(self):
        self._recording = True
        log.info("Recording started")

    def stop_recording(self):
        self._recording = False
        log.info("Recording stopped")

    def _excel_payload(self, timestamp, streamname, data):
        self._wb.active.append([timestamp, streamname, data])
        last_row = self._wb.active.max_row
        self._wb.active.cell(row=last_row, column=3).number_format = '0.000000'
        self._wb.save(self._create_path() + '/data3.xlsx')

    def _create_path(self):
        script_dir = Path(__file__).parent
        path = script_dir / 'CSV'
        path.mkdir(exist_ok=True)
        return str(path)
