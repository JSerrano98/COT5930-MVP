"""
WebSocket Monitor — connects to the session manager and prints live sensor data.

Usage:
    pip install websockets
    python test_monitor.py

Make sure the session manager (session.py) is already running.
"""

import asyncio
import json

import websockets


URI = "ws://localhost:8000/ws"


async def monitor():
    print(f"Connecting to {URI} ...")

    try:
        async with websockets.connect(URI) as ws:
            print("Connected — waiting for data...\n")

            async for message in ws:
                data = json.loads(message)

                stream = data.get("stream", "?")
                ts = data.get("timestamp", 0)
                values = data.get("data", [])

                # round values for readability
                display = [round(v, 4) for v in values]

                print(f"[{ts:.4f}]  {stream:<16}  {display}")

    except ConnectionRefusedError:
        print("Connection refused — is session.py running?")
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    asyncio.run(monitor())
