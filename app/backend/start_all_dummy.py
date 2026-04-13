"""
Start All Dummy Sensors

Dynamically discovers every DummySensor subclass in the sensors/dummy/ folder,
instantiates each one using a `default()` classmethod, and runs them all in one process.

To make your dummy sensor launchable by this script, add a default() classmethod
that returns a pre-configured instance:

    @classmethod
    def default(cls):
        return cls(
            uid="fake_ecg_001",
            name="FakeECG",
            type="ECG",
            channels=1,
            sample_rate=250,
        )

Sensors without a default() classmethod are skipped with a warning.

Usage:
    cd app/backend
    python start_all_dummy.py
"""

import importlib
import pkgutil
import time
import sys

from sensors.sensor import DummySensor
import sensors.dummy as dummy_pkg


def discover_sensors() -> list[DummySensor]:
    """
    Walk the sensors.dummy package, import every module, and collect
    any DummySensor subclass that defines a default() classmethod.
    """
    found = []
    skipped = []

    for finder, module_name, is_pkg in pkgutil.iter_modules(dummy_pkg.__path__):
        full_name = f"sensors.dummy.{module_name}"

        try:
            mod = importlib.import_module(full_name)
        except Exception as e:
            print(f"  ⚠  Could not import {full_name}: {e}")
            continue

        for attr_name in dir(mod):
            obj = getattr(mod, attr_name)

            if (
                isinstance(obj, type)
                and issubclass(obj, DummySensor)
                and obj is not DummySensor
            ):
                if hasattr(obj, "default") and callable(obj.default):
                    try:
                        instance = obj.default()
                        found.append(instance)
                    except Exception as e:
                        print(f"  ⚠  {obj.__name__}.default() failed: {e}")
                else:
                    skipped.append(obj.__name__)

    if skipped:
        print(f"\n  Skipped (no default() classmethod): {', '.join(skipped)}")

    return found


def main():
    print("Scanning sensors/dummy/ for dummy sensors...\n")

    sensors = discover_sensors()

    if not sensors:
        print("No launchable dummy sensors found.")
        print("Make sure your sensor class has a default() classmethod.")
        sys.exit(1)

    print(f"\nStarting {len(sensors)} sensor(s)...\n")

    for sensor in sensors:
        sensor.start()

    print(f"\n{'='*50}")
    print(f"  All {len(sensors)} dummy sensors running.")
    print(f"  Press Ctrl+C to stop.")
    print(f"{'='*50}\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        for sensor in sensors:
            sensor.stop()
        print("Done.")


if __name__ == "__main__":
    main()
