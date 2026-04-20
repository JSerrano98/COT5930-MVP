"""
Arduino Potentiometer Sensor

Reads analog values (0–1023) from an Arduino sketch that prints
one integer per line over USB serial at 9600 baud.

Arduino sketch expected:
    void setup() { Serial.begin(9600); }
    void loop()  { Serial.println(analogRead(A0)); delay(100); }
"""

import serial
import serial.tools.list_ports
from dataclasses import dataclass, field
from sensors.sensor import PhysicalSensor


def find_arduino_port() -> str | None:
    """
    Scan connected serial ports and return the first one that looks like an Arduino.
    Works on Windows (COM3), macOS (/dev/cu.usbmodem...), and Linux (/dev/ttyUSB0).
    """
    for port in serial.tools.list_ports.comports():
        desc = (port.description or "").lower()
        if any(k in desc for k in ("arduino", "ch340", "cp210", "ftdi", "usb serial")):
            return port.device
    return None


@dataclass
class ArduinoPotentiometer(PhysicalSensor):
    """
    Reads a single potentiometer channel from an Arduino over USB serial.

    The raw ADC value (0–1023) is optionally normalised to 0.0–1.0.
    Set normalize=False to stream the raw integer value instead.
    """

    port:      str   = ""       # leave blank to auto-detect
    baud:      int   = 9600
    normalize: bool  = True     # True → 0.0–1.0 | False → 0–1023

    _serial: serial.Serial | None = field(init=False, default=None)

    @classmethod
    def default(cls):
        port = find_arduino_port() or "COM3"   # fallback if auto-detect fails
        return cls(
            uid="arduino_pot_001",
            name="ArduinoPot",
            type="Analog",
            channels=1,
            sample_rate=10,    # Arduino sends ~10 samples/s (delay 100 ms)
            port=port,
            baud=9600,
            normalize=True,
        )

    def connect(self):
        if not self.port:
            self.port = find_arduino_port()
            if not self.port:
                raise RuntimeError(
                    "Could not auto-detect Arduino port. "
                    "Set port= explicitly (e.g. 'COM3' or '/dev/ttyUSB0')."
                )

        print(f"[{self.name}] Opening {self.port} @ {self.baud} baud…")
        self._serial = serial.Serial(self.port, self.baud, timeout=1)
        # Flush any garbage that accumulated while the port was closed
        self._serial.reset_input_buffer()
        print(f"[{self.name}] Connected — normalize={self.normalize}")

    def read_sample(self) -> list[float] | None:
        if not self._serial or not self._serial.is_open:
            return None

        try:
            line = self._serial.readline().decode("utf-8", errors="ignore").strip()
            if not line:
                return None
            raw = int(line)
            value = raw / 1023.0 if self.normalize else float(raw)
            return [value]
        except (ValueError, serial.SerialException):
            return None   # skip malformed lines / transient errors

    def disconnect(self):
        if self._serial and self._serial.is_open:
            self._serial.close()
        print(f"[{self.name}] Disconnected")


if __name__ == "__main__":
    sensor = ArduinoPotentiometer.default()
    sensor.run()