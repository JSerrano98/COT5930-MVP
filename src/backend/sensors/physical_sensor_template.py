"""
Physical Sensor Template

Copy this file into the physical/ folder and rename it.
Rename the class, then implement connect() and read_sample()
for your device's protocol.
"""

from dataclasses import dataclass
from sensors.sensor import PhysicalSensor


@dataclass
class MyPhysicalSensor(PhysicalSensor):  # ← rename this
    """Describe the device this connects to."""

    # Add device-specific settings
    # port: str = "/dev/ttyUSB0"
    # baud: int = 115200
    # host: str = "192.168.1.100"
    # mac_address: str = ""

    def connect(self):
        """
        Open the connection to the device.
        Runs once at startup. Store the handle on self.
        """
        pass  # ← replace with your connection code

    def read_sample(self) -> list[float] | None:
        """
        Read one sample from the device.
        Return a list with exactly 'channels' values, or None if
        no data is available yet.
        """
        pass  # ← replace with your reading code

    def disconnect(self):
        """
        Close the connection. Delete this method if nothing to clean up.
        """
        pass  # ← replace with cleanup code


# ── To start the sensor ─────────────────────────────────────
#
#   sensor = MyPhysicalSensor(
#       uid="",
#       name="",
#       type="",
#       channels=0,
#       sample_rate=0,
#   )
#   sensor.start()
