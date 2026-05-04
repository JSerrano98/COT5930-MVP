# Adding Non-LSL Bluetooth Devices to ECHO

This guide is for devices that send data over Bluetooth but do not already publish an LSL stream. In most cases, these are Bluetooth Low Energy (BLE) devices such as wearable sensors, EDA bands, heart-rate straps, or custom embedded boards.

If the device already ships with software that outputs LSL, use that software instead of writing a custom sensor.

---

## What Makes Bluetooth Different

Bluetooth devices usually do not behave like a simple serial cable. Instead, they often:

- Pair with the computer first
- Expose one or more Bluetooth services
- Send data through a specific characteristic UUID
- Push updates whenever new data is available

In this repo, the usual pattern is:

- Connect once in `connect()`
- Subscribe to notifications from the device
- Store the newest reading
- Return that reading from `read_sample()` when ECHO asks for the next sample

---

## Before You Start

Collect these details first:

| What you need | Example |
|---------------|---------|
| Device MAC address or identifier | `AA:BB:CC:DD:EE:FF` |
| Characteristic UUID that contains the sensor data | `00002a37-0000-1000-8000-00805f9b34fb` |
| Number of values in each reading | `1`, `2`, `8` |
| How the bytes should be decoded | 32-bit float, 16-bit int, packed bytes |
| Approximate update rate | `1`, `10`, `50` readings per second |

You usually get these from the vendor documentation, an SDK, or a Bluetooth scanner tool.

---

## Required Python Package

Most Bluetooth integrations in Python use `bleak`.

If it is not already installed in your environment, install it:

```bash
pip install bleak
```

If your device needs another vendor SDK, follow that vendor's instructions instead.

---

## Where the File Goes

Create your file in:

```text
backend/sensors/physical/
```

Start from:

```text
backend/sensors/templates/physical_sensor_template.py
```

Rename it to something clear, such as `my_ble_sensor.py`.

---

## Example: BLE Notification Device

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

---

## How the Example Works

- `connect()` pairs the Python code with the device and subscribes to a data characteristic
- `_on_data()` runs whenever the device sends a new Bluetooth notification
- The latest decoded reading is stored in `_latest`
- `read_sample()` hands that latest reading to ECHO

The example assumes the device sends 32-bit floating-point values. If your device sends integers or packed bytes, change the `struct.unpack(...)` line to match the vendor's format.

---

## Creating the Sensor Instance

Add this at the bottom of your file to test it directly:

```python
if __name__ == "__main__":
    sensor = MyBLEDevice(
        uid="ble_device_001",
        name="MyBLEDevice",
        type="EDA",
        channels=1,
        sample_rate=10,
        mac_address="AA:BB:CC:DD:EE:FF",
        char_uuid="00002a37-0000-1000-8000-00805f9b34fb",
    )
    sensor.run()
```

### What these fields mean

| Field | Meaning |
|-------|---------|
| `uid` | Unique ID for this sensor instance |
| `name` | Stream name shown in ECHO |
| `type` | Signal category such as `EDA`, `ECG`, `EEG`, or `Respiration` |
| `channels` | Number of values in each notification |
| `sample_rate` | Expected update frequency in readings per second |

---

## Test It First

1. Make sure the device is powered on and paired if pairing is required
2. Run the file:

```bash
python -m sensors.physical.my_ble_sensor
```

3. Open ECHO and click **Refresh** on the dashboard
4. Confirm the stream appears

If it appears, your Bluetooth integration is working.

---

## Make It Launch with `start_all_sensors.py`

To make the repo's main sensor launcher start the Bluetooth device automatically, add:

```python
@classmethod
def default(cls):
    return cls(
        uid="ble_device_001",
        name="MyBLEDevice",
        type="EDA",
        channels=1,
        sample_rate=10,
        mac_address="AA:BB:CC:DD:EE:FF",
        char_uuid="00002a37-0000-1000-8000-00805f9b34fb",
    )
```

---

## Troubleshooting

| Problem | What to check |
|---------|---------------|
| Device does not connect | Make sure Bluetooth is enabled and the device is in range |
| Pairing fails | Remove the device from the OS Bluetooth list and pair again |
| No data arrives | Verify the characteristic UUID is correct |
| Values are nonsense | The byte decoding format is probably wrong |
| Stream appears but updates are irregular | Some BLE devices send in bursts; check whether the advertised update rate is approximate |
| Another app already owns the device | Close the vendor app or any Bluetooth monitor tool that may be connected |

---

## When to Use a Different Approach

- If the device behaves like a USB serial device, use [ADDING NON LSL USB DEVICES.md](ADDING%20NON%20LSL%20USB%20DEVICES.md)
- If the device already publishes LSL, no custom code is needed
- If the vendor provides a Python SDK, use that SDK inside `connect()` and `read_sample()` instead of `bleak` when appropriate