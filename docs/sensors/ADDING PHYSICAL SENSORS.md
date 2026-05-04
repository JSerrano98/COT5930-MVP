# Adding Physical Sensors to ECHO

This guide explains the shared pattern for connecting a real hardware device that does not natively support Lab Streaming Layer (LSL) to ECHO. After following this process, the device will appear on the dashboard and its data can be recorded alongside the rest of your streams.

If you already know your device type, use one of these focused guides first:

- [ADDING NON LSL USB DEVICES.md](ADDING%20NON%20LSL%20USB%20DEVICES.md)
- [ADDING NON LSL BLUETOOTH DEVICES.md](ADDING%20NON%20LSL%20BLUETOOTH%20DEVICES.md)

Examples of devices you might connect: heart rate monitors via USB serial, EDA sensors via Bluetooth, custom Arduino boards, and any device that sends data over a network or cable.

> **Device already supports LSL?** Open the manufacturer's LSL app, start streaming, then click **Refresh** in the ECHO dashboard. No code needed.

---

## What You Need to Know About the Device

Before writing any code, gather this information from the device's datasheet or manual:

| Question | Where it ends up in your code |
|----------|-------------------------------|
| How does it connect? (USB serial, Bluetooth, TCP network, SDK) | `connect()` method |
| What format does it send data in? (CSV text, raw binary, SDK function) | `read_sample()` method |
| How many numbers does it send per reading? | `channels` parameter |
| How many readings per second? | `sample_rate` parameter |

---

## How It Works

You create a Python class for your device that fills in three methods. The base class (`PhysicalSensor`) handles everything else — threading, timing, LSL stream creation, and integration with the dashboard.

The three methods you fill in:

- **`connect()`** — Opens the connection to the device. Called once when the sensor starts.
- **`read_sample()`** — Reads one measurement from the device. Called repeatedly in a loop. Return a list of numbers (one per channel), or `None` if there is nothing to read yet.
- **`disconnect()`** — Closes the connection. Called when the sensor stops. This is optional but recommended for clean shutdown.

---

## Setup

1. Copy `backend/sensors/templates/physical_sensor_template.py` into `backend/sensors/physical/`
2. Rename the file to match your device (e.g., `my_heart_monitor.py`)
3. Rename the class inside the file to match (e.g., `class MyHeartMonitor`)
4. Fill in `connect()` and `read_sample()` using the examples below as a starting point

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

## Starting the Sensor

### Standalone test (recommended)

Add this block at the bottom of your file and run it directly to verify the sensor streams correctly before wiring it into the full app.

While the script is running, open the ECHO dashboard and click **Refresh** — your device should appear in the stream list.

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

### Inside `start_all_sensors.py`

To make the sensor launch automatically with the rest of ECHO, add a `default()` classmethod to your class:

```python
@classmethod
def default(cls):
    return cls(
        uid="device_001",
        name="MyDevice",
        type="ECG",
        channels=3,
        sample_rate=250,
        port="/dev/ttyUSB0",
    )
```

`start_all_sensors.py` automatically discovers any sensor in `sensors/physical/` that has a `default()` method and starts it along with everything else.

### Inside another script — use `start()` / `stop()`:

```python
sensor = MySerialDevice(...)
sensor.start()   # returns immediately, streams in background
# ... later ...
sensor.stop()    # stops streaming and disconnects
```

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Sensor starts but no stream appears on dashboard | Click **Refresh** in the dashboard. Make sure `name` matches what you expect. |
| `connect()` throws an error | Check the port name, baud rate, or network address. Make sure drivers are installed. |
| `read_sample()` returns garbage values | Check the data format — byte order, number of bytes per value, or parsing logic |
| Sensor appears but immediately disconnects | An unhandled exception in `read_sample()` is stopping the loop — check the terminal for the error |
| Port not found (serial) | On Windows: check Device Manager for the COM port number. On Mac/Linux: check `/dev/tty.*` |
| Bluetooth won't connect | Make sure the device is paired and in range. BLE connections can be finicky — try restarting the device. |
