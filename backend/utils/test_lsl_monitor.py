"""
Direct LSL Monitor

Reads LSL streams directly and prints incoming sample values.
Useful for debugging sensors independently of FastAPI/WebSocket/frontend.

Examples:
    python test_lsl_monitor.py
    python test_lsl_monitor.py --stream CL806_HR
    python test_lsl_monitor.py --stream CL806_HR --timeout 12
"""

from __future__ import annotations

import argparse
import time

from pylsl import StreamInlet, resolve_byprop, resolve_streams


def _format_sample(sample: list[float], decimals: int = 3) -> str:
    return "[" + ", ".join(f"{v:.{decimals}f}" for v in sample) + "]"


def main() -> int:
    parser = argparse.ArgumentParser(description="Print live values from LSL streams")
    parser.add_argument(
        "--stream",
        default="",
        help="Optional exact LSL stream name to monitor (example: CL806_HR)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=5.0,
        help="Resolve timeout in seconds (default: 5)",
    )
    args = parser.parse_args()

    if args.stream:
        print(f"Resolving stream by name '{args.stream}' ({args.timeout:.1f}s)...")
        streams = resolve_byprop("name", args.stream, timeout=args.timeout)
    else:
        print(f"Resolving all LSL streams ({args.timeout:.1f}s)...")
        streams = resolve_streams(args.timeout)

    if not streams:
        if args.stream:
            print(f"No stream found with name '{args.stream}'.")
        else:
            print("No LSL streams found.")
        return 1

    inlets: list[dict] = []
    for info in streams:
        inlet = StreamInlet(info, max_buflen=1)
        inlet.open_stream()
        inlets.append(
            {
                "name": info.name(),
                "type": info.type(),
                "rate": info.nominal_srate(),
                "inlet": inlet,
            }
        )

    print("Monitoring stream(s). Press Ctrl+C to stop.\n")
    for s in inlets:
        print(f"- {s['name']} ({s['type']}, {s['rate']} Hz)")
    print()

    try:
        while True:
            saw_data = False
            for s in inlets:
                sample, timestamp = s["inlet"].pull_sample(timeout=0.0)
                if sample is None:
                    continue

                saw_data = True
                print(f"[{timestamp:.3f}] {s['name']:<16} {_format_sample(sample)}")

            if not saw_data:
                time.sleep(0.01)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        for s in inlets:
            try:
                s["inlet"].close_stream()
            except Exception:
                pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())