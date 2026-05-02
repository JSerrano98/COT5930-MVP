"""
Start CL806 Sensor Only

Runs only the CL806 BLE heart-rate bridge and publishes it to LSL.
Use this when you want focused debugging without other sensors.

Usage:
    cd backend
    python ./sensors/start_cl806.py
"""

import sys
import time
from pathlib import Path

# Ensure backend/ is importable when invoked as ./sensors/start_cl806.py
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sensors.physical.cl806_heart_rate import CL806HeartRate


def main():
    print("=" * 54)
    print("  ECHO — Start CL806 Only")
    print("=" * 54)
    print()

    sensor = CL806HeartRate.default()
    print(f"Preparing sensor: {sensor.name}")

    try:
        sensor.start()
    except Exception as e:
        print(f"[x] Failed to start {sensor.name}: {e}")
        sys.exit(1)

    print()
    print("Streaming. Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        try:
            sensor.stop()
        except Exception:
            pass
        print("Done.")


if __name__ == "__main__":
    main()
