





#ECHO Backend — FastAPI Application

#Main entry point for the backend server.
#Uses SessionManager for all LSL/WebSocket logic.

import sys


import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from dashboard.session_manager import SessionManager
from machine_learning.router import router as ml_router
from sensors.ml_sensor import MLPredictionSensor
import os
import pandas as pd


STORAGE_PATH = './data/CSV'

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
session = SessionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await session.stop()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ml_router)

# ════════════════════════════════════════════════════════════════════
# INFO
# ════════════════════════════════════════════════════════════════════
@app.get("/")
async def root():
    return {
        "app": "ECHO",
        "description": "Enhanced Cognitive Human Operations — a research tool for monitoring, recording, and processing physiological data with machine learning.",
        "repo": "https://github.com/JSerrano98/COT5930-MVP",
        "status": session.status,
    }

@app.get("/health")
async def health():
    return {"status": "ok", "session": session.status}

# ════════════════════════════════════════════════════════════════════
# SESSION
# ════════════════════════════════════════════════════════════════════
@app.post("/session/start")
async def start_session():
    if session.status == "Online":
        return {"ok": True, "status": session.status}
    session.start()
    return {"ok": True, "status": session.status}

@app.post("/session/stop")
async def stop_session():
    await session.stop()
    return {"ok": True, "status": session.status}

# ════════════════════════════════════════════════════════════════════
# STREAMS
# ════════════════════════════════════════════════════════════════════
@app.get("/streams")
def list_streams():
    return session.list_streams()

@app.post("/refresh")
def refresh_streams():
    return session.refresh()

# ════════════════════════════════════════════════════════════════════
# RECORDING
# ════════════════════════════════════════════════════════════════════
from pydantic import BaseModel

class RecordStartRequest(BaseModel):
    file_path: str | None = None
    format: str = "csv"  # "csv" or "xlsx"

@app.post("/record/start")
def start_recording(req: RecordStartRequest = RecordStartRequest()):
    session.start_recording(file_path=req.file_path, fmt=req.format)
    return {"recording": True}


@app.post("/record/stop")
def stop_recording():
    saved_path = session.stop_recording()
    return {"recording": False, "saved_to": saved_path}

# ════════════════════════════════════════════════════════════════════
# WEBSOCKET
# ════════════════════════════════════════════════════════════════════
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    await session.add_client(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        session.remove_client(ws)




@app.get('/replay')
def replay():
     return {"ok": True, "status": 'success'}


@app.get('/CSV/')
def list_files():
    # Get all file names in the directory
    print('help')
    try:
        files = os.listdir(STORAGE_PATH)
        return files
    except FileNotFoundError:
        return {"error": "Directory not found"}, 404


@app.get('/ML/')
async def read_user_item(file: str):
##seperate pd.read function from app.py later
    print(file)
    try:
        
        df = pd.read_csv(STORAGE_PATH + '/'  + file )
        columns = df.columns.to_list()
        return columns
    except:
        print('test for multiple file types')
    try:
        df = pd.read_excel(STORAGE_PATH + '/' + file)
        columns = df.columns.to_list()
        return columns
    except:
        return {"error": "Invalid file type"}, 400


# ════════════════════════════════════════════════════════════════════
# ML SENSORS — load trained models as real-time prediction streams
# ════════════════════════════════════════════════════════════════════

_ml_sensors: dict[str, MLPredictionSensor] = {}


class MLSensorStartRequest(BaseModel):
    uid: str
    name: str
    source_name: str
    model_path: str
    source_type: str = ""
    buffer_seconds: float = 2.0
    process_interval: float = 0.1
    sample_rate: float = 0.0   # 0 = irregular (predict-on-demand)


@app.post("/ml-sensors/start")
def start_ml_sensor(req: MLSensorStartRequest):
    if req.uid in _ml_sensors:
        return {"ok": True, "uid": req.uid, "note": "already running"}

    sensor = MLPredictionSensor(
        uid=req.uid,
        name=req.name,
        type="ML",
        channels=1,           # adjusted automatically in _setup
        sample_rate=req.sample_rate,
        source_name=req.source_name,
        source_type=req.source_type,
        buffer_seconds=req.buffer_seconds,
        process_interval=req.process_interval,
        model_path=req.model_path,
    )
    sensor.start()
    _ml_sensors[req.uid] = sensor
    return {"ok": True, "uid": req.uid, "name": req.name}


@app.delete("/ml-sensors/{uid}")
def stop_ml_sensor(uid: str):
    sensor = _ml_sensors.pop(uid, None)
    if sensor is None:
        return {"ok": False, "error": f"No ML sensor with uid '{uid}'"}
    sensor.stop()
    return {"ok": True, "uid": uid}


@app.get("/ml-sensors")
def list_ml_sensors():
    return {
        "sensors": [
            {
                "uid": uid,
                "name": s.name,
                "source_name": s.source_name,
                "model_path": s.model_path,
                "channels": s.channels,
                "running": s._running,
            }
            for uid, s in _ml_sensors.items()
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


