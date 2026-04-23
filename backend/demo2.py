"""
WebSocket Monitor — connects to the session manager and prints live sensor data.

Usage:
    pip install websockets
    python test_monitor.py

Make sure the session manager (session.py) is already running.
"""

##test file for simple Excel conversion

import asyncio
import json
import openpyxl
import websockets
from pathlib import Path
import pandas as pd
import numpy as np

cols = []
wb = openpyxl.Workbook()
wb.active.append(cols)
df = pd.array(cols)
dict = {}

def create_path():
    script_dir = Path(__file__).parent
    path = script_dir / 'CSV'
    return str(path)


def Excel_payload(StreamData):
    StreamData.to_excel(str(create_path()) + '/data4.xlsx', index=False
    wb.save(create_path() + '/data3.xlsx')
    return

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
                display.append(ts)
                
                if stream in dict:
                    dict[stream].append([display])
                else:
                    dict[stream] = [display]

    except ConnectionRefusedError:
        print("Connection refused — is session.py running?")
    except KeyboardInterrupt:
        result = np.concatenate([dict[k] for k in sorted(dict.keys())], axis = 1)
        for key, value in dict.items():
            for i in range(len(value[0])):
                cols.append(key + 'data' + str(i+1))
        df = pd.DataFrame(result, cols)

        
        print("\nStopped.")


if __name__ == "__main__":
    asyncio.run(monitor())