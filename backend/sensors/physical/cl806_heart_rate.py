"""
CL806 Heart Rate Monitor (BLE)

Wraps a CL806-compatible BLE heart rate device into an LSL outlet.
Uses the standard Heart Rate Service notification characteristic:
  - Service: 0x180D
  - Measurement Characteristic: 0x2A37

Device selection priority:
  1) Explicit BLE address (recommended)
    2) Device name match (default: "CL806", prefix/contains supported)

Environment variables (optional):
  - CL806_BLE_ADDRESS=AA:BB:CC:DD:EE:FF
    - CL806_BLE_NAME=CL806
"""

from __future__ import annotations

import asyncio
import os
import queue
import threading
import time
from dataclasses import dataclass, field

from sensors.sensor import PhysicalSensor

HEART_RATE_MEASUREMENT_CHAR_UUID = "00002a37-0000-1000-8000-00805f9b34fb"


@dataclass
class CL806HeartRate(PhysicalSensor):
    """Streams BPM from a CL806 BLE heart-rate monitor into LSL."""

    # Use address for deterministic pairing when multiple BLE devices are nearby.
    ble_address: str | None = None
    ble_name: str = "CL806"
    scan_timeout: float = 8.0
    poll_interval: float = 0.01

    _loop: asyncio.AbstractEventLoop | None = field(init=False, default=None)
    _ble_thread: threading.Thread | None = field(init=False, default=None)
    _client: object | None = field(init=False, default=None)
    _connected: threading.Event = field(init=False, default_factory=threading.Event)
    _stop_evt: threading.Event = field(init=False, default_factory=threading.Event)
    _sample_q: queue.Queue[list[float]] = field(init=False, default_factory=queue.Queue)
    _error: Exception | None = field(init=False, default=None)

    @classmethod
    def default(cls):
        return cls(
            uid="cl806_hr_001",
            name="CL806_HR",
            type="HeartRate",
            channels=1,
            # HR measurement notifications are event-driven (roughly beat-to-beat),
            # not a fixed-rate waveform stream. In LSL, nominal_srate=0 means irregular timing.
            sample_rate=0,
            channel_labels=["bpm"],
            ble_address=os.getenv("CL806_BLE_ADDRESS") or None,
            ble_name=os.getenv("CL806_BLE_NAME", "CL806"),
            scan_timeout=8.0,
            poll_interval=0.01,
        )

    def _parse_heart_rate(self, data: bytearray) -> float | None:
        """Parse BLE Heart Rate Measurement payload per spec (0x2A37)."""
        if not data:
            return None

        flags = data[0]
        is_uint16 = bool(flags & 0x01)

        if is_uint16:
            if len(data) < 3:
                return None
            bpm = int.from_bytes(data[1:3], byteorder="little", signed=False) 
        else:
            if len(data) < 2:
                return None
            bpm = data[1]

        return float(bpm)

    async def _find_device(self):
        from bleak import BleakScanner

        if self.ble_address:
            dev = await BleakScanner.find_device_by_address(
                self.ble_address,
                timeout=self.scan_timeout,
            )
            if dev is None:
                raise RuntimeError(
                    f"CL806 device not found at address {self.ble_address}. "
                    "Ensure it is powered on and not connected to another app."
                )
            return dev

        devices = await BleakScanner.discover(timeout=self.scan_timeout)
        target = (self.ble_name or "").strip().lower()

        # Try exact name first, then prefix, then substring.
        exact = None
        prefix = None
        contains = None
        for dev in devices:
            name = (getattr(dev, "name", "") or "").strip()
            lname = name.lower()
            if not lname:
                continue
            if target and lname == target:
                exact = dev
                break
            if target and lname.startswith(target) and prefix is None:
                prefix = dev
            if target and target in lname and contains is None:
                contains = dev

        dev = exact or prefix or contains
        if dev is None:
            raise RuntimeError(
                f"CL806 device name '{self.ble_name}' not found. "
                "Set CL806_BLE_ADDRESS for a deterministic match."
            )
        return dev

    async def _connect_and_stream(self):
        from bleak import BleakClient

        device = await self._find_device()
        print(f"[{self.name}] Connecting to BLE device: {device}")

        client = BleakClient(device)
        self._client = client

        def _on_hr(_sender: int, data: bytearray):
            bpm = self._parse_heart_rate(data)
            if bpm is not None:
                self._sample_q.put([bpm])

        await client.connect()
        await client.start_notify(HEART_RATE_MEASUREMENT_CHAR_UUID, _on_hr)

        self._connected.set()
        print(f"[{self.name}] BLE connected; streaming HR notifications")

        try:
            while not self._stop_evt.is_set():
                await asyncio.sleep(0.1)
        finally:
            try:
                await client.stop_notify(HEART_RATE_MEASUREMENT_CHAR_UUID)
            except Exception:
                pass

            if client.is_connected:
                await client.disconnect()

    def _ble_thread_main(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._connect_and_stream())
        except Exception as exc:
            self._error = exc
            self._connected.set()
        finally:
            self._loop.close()
            self._loop = None

    def connect(self):
        self._stop_evt.clear()
        self._error = None
        self._connected.clear()

        self._ble_thread = threading.Thread(target=self._ble_thread_main, daemon=True)
        self._ble_thread.start()

        if not self._connected.wait(timeout=self.scan_timeout + 5):
            raise RuntimeError("Timed out waiting for CL806 BLE connection")

        if self._error is not None:
            raise RuntimeError(f"CL806 connection failed: {self._error}")

    def read_sample(self) -> list[float] | None:
        if self._error is not None:
            raise RuntimeError(f"CL806 BLE stream error: {self._error}")

        try:
            return self._sample_q.get_nowait()
        except queue.Empty:
            return None

    def _loop_body(self):
        if self._error is not None:
            raise RuntimeError(f"CL806 BLE stream error: {self._error}")

        pushed = 0
        while True:
            try:
                self.push(self._sample_q.get_nowait())
                pushed += 1
            except queue.Empty:
                break

        if pushed == 0:
            time.sleep(self.poll_interval)

    def disconnect(self):
        self._stop_evt.set()
        if self._ble_thread:
            self._ble_thread.join(timeout=5)
        print(f"[{self.name}] Disconnected")


if __name__ == "__main__":
    sensor = CL806HeartRate.default()
    sensor.run()