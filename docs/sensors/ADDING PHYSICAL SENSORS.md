# Physical Sensor Implementation Guide

This covers wrapping a non-LSL hardware device into an Echo sensor. You'll need to know how the device communicates (serial, BLE, TCP, SDK) and what its data format looks like.

---

## Overview

`PhysicalSensor` subclasses `Sensor` and provides three hooks:

- `connect()` — open the connection to the device (called once at startup)
- `read_sample()` — read one sample from the device (called in a loop)
- `disconnect()` — close the connection (called on stop, optional)

The base class handles threading, LSL outlet creation, and timing.

---

## Setup

1. Copy `physical_sensor_template.py` into `sensors/physical/`
2. Rename the file and class to match your device
3. Implement `connect()` and `read_sample()` based on the device's protocol

---

## Protocol Examples

### Serial / USB

```python
from dataclasses import dataclass
from sensors.sensor import PhysicalSensor

@dataclass
class MySerialDevice(PhysicalSensor):
    port: str = "/dev/ttyUSB0"
    baud: int = 115200

    def connect(self):
        import serial
        self._serial = serial.Serial(self.port, self.baud, timeout=1)

    def read_sample(self) -> list[float] | None:
        line = self._serial.readline().decode("utf-8").strip()
        if not line:
            return None
        return [float(x) for x in line.split(",")]

    def disconnect(self):
        if self._serial:
            self._serial.close()
```

### Bluetooth Low Energy

```python
import struct
from dataclasses import dataclass, field
from sensors.sensor import PhysicalSensor

@dataclass
class MyBLEDevice(PhysicalSensor):
    mac_address: str = ""
    char_uuid: str = ""
    _latest: list[float] | None = field(init=False, default=None)

    def connect(self):
        import asyncio
        from bleak import BleakClient

        async def _connect():
            self._client = BleakClient(self.mac_address)
            await self._client.connect()
            await self._client.start_notify(self.char_uuid, self._on_data)

        asyncio.run(_connect())

    def _on_data(self, sender, data: bytearray):
        n = len(data) // 4
        self._latest = list(struct.unpack(f"<{n}f", data))

    def read_sample(self) -> list[float] | None:
        sample = self._latest
        self._latest = None
        return sample

    def disconnect(self):
        import asyncio
        if self._client:
            asyncio.run(self._client.disconnect())
```

### TCP Socket

```python
import struct
from dataclasses import dataclass
from sensors.sensor import PhysicalSensor

@dataclass
class MyTCPDevice(PhysicalSensor):
    host: str = "192.168.1.100"
    port: int = 5000

    def connect(self):
        import socket
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.connect((self.host, self.port))

    def read_sample(self) -> list[float] | None:
        bytes_needed = self.channels * 4
        data = b""
        while len(data) < bytes_needed:
            chunk = self._sock.recv(bytes_needed - len(data))
            if not chunk:
                return None
            data += chunk
        return list(struct.unpack(f"<{self.channels}f", data))

    def disconnect(self):
        if self._sock:
            self._sock.close()
```

---

## What You Need From the Datasheet

| Question | Where it goes |
|----------|--------------|
| How does it connect? (USB, BLE, TCP, SDK) | `connect()` |
| What format is the data? (CSV text, binary, SDK call) | `read_sample()` |
| How many values per reading? | `channels` |
| Readings per second? | `sample_rate` |

---

## Starting the Sensor

Standalone script — use `run()`:

```python
if __name__ == "__main__":
    sensor = MySerialDevice(
        uid="device_001",
        name="MyDevice",
        type="ECG",
        channels=3,
        sample_rate=250,
        port="/dev/ttyUSB0",
    )
    sensor.run()  # blocks until Ctrl+C
```

Inside a larger app — use `start()` / `stop()`:

```python
sensor = MySerialDevice(...)
sensor.start()   # returns immediately, streams in background
# ... later ...
sensor.stop()    # stops streaming and disconnects
```
