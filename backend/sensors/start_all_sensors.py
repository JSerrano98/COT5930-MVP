"""
Start All Sensors — ECHO

Dynamically discovers every launchable sensor across all sensor subpackages:
  - sensors/dummy/    — DummySensor subclasses  (fake/test data)
  - sensors/physical/ — PhysicalSensor subclasses (real hardware)
  - sensors/derived/  — DerivedSensor subclasses  (computed metrics)

To make any sensor auto-launchable by this script, add a default() classmethod
that returns a pre-configured instance:

    @classmethod
    def default(cls):
        return cls(
            uid="my_sensor_001",
            name="MySensor",
            type="ECG",
            channels=1,
            sample_rate=250,
        )

Sensors without a default() classmethod are skipped with a warning.
Derived sensors require their source stream to already be running — they are
started last to give physical/dummy sensors time to come online.

Usage:
    cd backend
    python sensors/start_all_sensors.py
"""

import importlib
import pkgutil
import time
import sys

from sensors.sensor import DummySensor, PhysicalSensor, DerivedSensor
import sensors.dummy   as dummy_pkg
import sensors.derived as derived_pkg

# Physical package is optional — only import if it exists and has an __init__
try:
    import sensors.physical as physical_pkg
    _PHYSICAL_AVAILABLE = True
except ImportError:
    _PHYSICAL_AVAILABLE = False

# ─── Packages to scan in startup order ───────────────────────────────────────
# Derived sensors are intentionally last — their sources must be running first.
PACKAGES = [
    (dummy_pkg,   "sensors.dummy",   DummySensor),
]

if _PHYSICAL_AVAILABLE:
    PACKAGES.append((physical_pkg, "sensors.physical", PhysicalSensor))

PACKAGES.append((derived_pkg, "sensors.derived", DerivedSensor))


# ─── Discovery ────────────────────────────────────────────────────────────────

def discover_sensors() -> tuple[list, list, list]:
    """
    Walk every registered package and collect instantiated sensors.

    Returns:
        (sensors, skipped_names, failed_names)
    """
    found   = []   # ready-to-start sensor instances
    skipped = []   # class names with no default()
    failed  = []   # class names whose default() raised

    seen_classes = set()  # guard against duplicate imports across packages

    for pkg, prefix, base_class in PACKAGES:
        for _finder, module_name, _is_pkg in pkgutil.iter_modules(pkg.__path__):
            full_name = f"{prefix}.{module_name}"
            try:
                mod = importlib.import_module(full_name)
            except Exception as e:
                print(f"  [!] Could not import {full_name}: {e}")
                continue

            for attr_name in dir(mod):
                obj = getattr(mod, attr_name)

                if not (isinstance(obj, type) and issubclass(obj, base_class)):
                    continue
                if obj is base_class or obj in seen_classes:
                    continue
                # Skip abstract base classes from sensor.py itself
                if obj in (DummySensor, PhysicalSensor, DerivedSensor):
                    continue

                seen_classes.add(obj)

                if not (hasattr(obj, "default") and callable(obj.default)):
                    skipped.append(obj.__name__)
                    continue

                try:
                    instance = obj.default()
                    found.append(instance)
                    kind = (
                        "DUMMY"    if isinstance(instance, DummySensor)    else
                        "PHYSICAL" if isinstance(instance, PhysicalSensor) else
                        "DERIVED"
                    )
                    print(f"  [+] [{kind}] {obj.__name__}")
                except Exception as e:
                    print(f"  [x] {obj.__name__}.default() raised: {e}")
                    failed.append(obj.__name__)

    return found, skipped, failed


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    print("=" * 54)
    print("  ECHO — Start All Sensors")
    print("=" * 54)
    print()
    print("Scanning sensor packages...\n")

    sensors, skipped, failed = discover_sensors()

    if skipped:
        print(f"\n  Skipped (no default() classmethod): {', '.join(skipped)}")
    if failed:
        print(f"\n  Failed to instantiate: {', '.join(failed)}")

    if not sensors:
        print("\nNo launchable sensors found.")
        print("Add a default() classmethod to any sensor class to include it.")
        sys.exit(1)

    # Separate derived from the rest so we can start them after a short delay
    non_derived = [s for s in sensors if not isinstance(s, DerivedSensor)]
    derived     = [s for s in sensors if     isinstance(s, DerivedSensor)]

    print(f"\nStarting {len(non_derived)} source sensor(s)...\n")
    started = []
    for sensor in non_derived:
        try:
            sensor.start()
            started.append(sensor)
        except Exception as e:
            print(f"  [x] Failed to start {sensor.name}: {e}")

    if derived:
        print(f"\nWaiting 2 s for source streams to come online...")
        time.sleep(2)
        print(f"Starting {len(derived)} derived sensor(s)...\n")
        for sensor in derived:
            try:
                sensor.start()
                started.append(sensor)
            except Exception as e:
                print(f"  [x] Failed to start {sensor.name}: {e}")

    print()
    print("=" * 54)
    print(f"  {len(started)} sensor(s) running. Press Ctrl+C to stop.")
    print("=" * 54)
    print()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        for sensor in reversed(started):
            try:
                sensor.stop()
            except Exception:
                pass
        print("Done.")


if __name__ == "__main__":
    main()
