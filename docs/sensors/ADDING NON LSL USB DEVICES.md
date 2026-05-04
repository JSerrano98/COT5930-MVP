# Adding Non-LSL USB Devices to ECHO

This guide is for devices that connect by USB but do not already publish an LSL stream. Common examples are Arduino-based sensors, serial heart-rate devices, and custom lab hardware that appears as a COM port.

If the device already comes with software that publishes LSL, do not write code here. Start the manufacturer's LSL app instead and click **Refresh** in ECHO.

---

## What This Guide Helps You Do

You will create a small Python file that:

- Opens the USB connection to the device
- Reads one sample at a time from the device
- Publishes those samples into ECHO as an LSL stream

Once that file is running, the device can be viewed on the dashboard just like any other sensor.

---

## Before You Start

Find these details in the device manual or from whoever built the hardware:

| What you need | Example |
|---------------|---------|
| Port name | `COM4` on Windows, `/dev/ttyUSB0` on Linux |
| Baud rate | `115200` |
| Values per reading | `1`, `3`, `8` |
| Data format | `72.3` or `0.12,0.31,0.44` |
| Readings per second | `10`, `100`, `250` |

If you do not know the COM port on Windows, open **Device Manager** and look under **Ports (COM & LPT)**.

---

## Where the File Goes

Create your device file in:

```text
backend/sensors/physical/
```

Start from this template:

```text
backend/sensors/templates/physical_sensor_template.py
```

Rename it to something clear, such as `my_usb_heart_sensor.py`.

---

## The Pattern

USB devices in this repo should inherit from `PhysicalSensor` and implement three methods:

- `connect()` opens the USB or serial connection
- `read_sample()` returns one list of numbers
- `disconnect()` closes the connection

The base class handles the background thread and the LSL stream.

---

## Example: USB Serial Device

```python
from dataclasses import dataclass
from sensors.sensor import PhysicalSensor


@dataclass
class MyUSBDevice(PhysicalSensor):
    port: str = "COM4"
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

### What the example assumes

- The device sends plain text over USB serial
- Each line is one reading
- Multiple channels are separated by commas

Examples:

- One channel: `72.3`
- Three channels: `0.12,0.31,0.44`

If your device sends binary bytes instead of text, you will need to decode those bytes differently inside `read_sample()`.

---

## Creating the Sensor Instance

At the bottom of the file, add a standalone test block:

```python
if __name__ == "__main__":
    sensor = MyUSBDevice(
        uid="usb_device_001",
        name="MyUSBDevice",
        type="ECG",
        channels=3,
        sample_rate=250,
        port="COM4",
        baud=115200,
    )
    sensor.run()
```

### What these fields mean

| Field | Meaning |
|-------|---------|
| `uid` | A unique ID for this sensor instance |
| `name` | The stream name shown in ECHO |
| `type` | The signal category, such as `ECG`, `EDA`, `EEG`, or `Temperature` |
| `channels` | How many numbers are in each reading |
| `sample_rate` | How many readings per second the device produces |

`channels` must exactly match the number of values returned by `read_sample()`.

---

## Test It First

Run your device from the project root or from `backend/` using Python module mode:

```bash
python -m sensors.physical.my_usb_heart_sensor
```

Then open ECHO, go to the dashboard, and click **Refresh**. Your device should appear in the stream list.

If it appears, the USB integration is working.

---

## Make It Launch with `start_all_sensors.py`

If you want ECHO's sensor launcher to start the device automatically, add this classmethod:

```python
@classmethod
def default(cls):
    return cls(
        uid="usb_device_001",
        name="MyUSBDevice",
        type="ECG",
        channels=3,
        sample_rate=250,
        port="COM4",
        baud=115200,
    )
```

That makes the device auto-discoverable by the repo's sensor launcher.

---

## Troubleshooting

| Problem | What to check |
|---------|---------------|
| Nothing appears in ECHO | Make sure the script is running, then click **Refresh** on the dashboard |
| `COM` port not found | Verify the correct port in Device Manager |
| Permission error on the port | Close other apps that may already be using the device |
| Numbers look wrong | Check baud rate, line endings, and whether the device sends text or binary |
| Stream appears then stops | Look in the terminal for an exception in `read_sample()` |

---

## When to Use a Different Approach

- If the device connects over Bluetooth, use [ADDING NON LSL BLUETOOTH DEVICES.md](ADDING%20NON%20LSL%20BLUETOOTH%20DEVICES.md)
- If the device already publishes LSL, no custom sensor file is needed
- If the device talks over Ethernet or Wi-Fi, the general [ADDING PHYSICAL SENSORS.md](ADDING%20PHYSICAL%20SENSORS.md) guide is the better starting point