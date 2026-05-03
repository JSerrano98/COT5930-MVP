







import sys


import logging
import pickle

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from dashboard.session_manager import SessionManager
from machine_learning.router import router as ml_router
from sensors.ml_sensor import MLPredictionSensor
from sensors.dummy.csv_replay import CSVReplaySensor
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

@app.get("/streams")
def list_streams():
    return session.list_streams()

@app.post("/refresh")
def refresh_streams():
    return session.refresh()

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
    print('help')
    try:
        files = os.listdir(STORAGE_PATH)
        return files
    except FileNotFoundError:
        return {"error": "Directory not found"}, 404


@app.get('/ML/')
async def read_user_item(file: str):
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



_ml_sensors: dict[str, MLPredictionSensor] = {}
_csv_replays: dict[str, dict] = {}


class MLSensorStartRequest(BaseModel):
    uid: str
    name: str
    source_name: str = ""
    source_names: list[str] = []
    model_path: str
    source_type: str = ""
    buffer_seconds: float = 2.0
    process_interval: float = 0.1
    sample_rate: float = 0.0   # 0 = irregular (predict-on-demand)
    feature_aliases: dict[str, str] = {}


def _resolve_model_path(path: str) -> str:
    if os.path.isabs(path):
        return path
    backend_root = os.path.dirname(__file__)
    return os.path.normpath(os.path.join(backend_root, path))


@app.get("/ml-models/metadata")
def get_ml_model_metadata(path: str):
    resolved = _resolve_model_path(path)
    if not os.path.exists(resolved):
        raise HTTPException(status_code=404, detail=f"Model file not found: {resolved}")

    try:
        with open(resolved, "rb") as f:
            bundle = pickle.load(f)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read model file: {exc}") from exc

    feature_cols = [str(c) for c in (bundle.get("feature_cols", []) or [])]
    label_col = str(bundle.get("label_col", ""))
    task = str(bundle.get("task", "")).strip().lower()
    model_key = str(bundle.get("model_key", "")).strip()

    return {
        "ok": True,
        "path": resolved,
        "task": task,
        "model_key": model_key,
        "label_col": label_col,
        "feature_cols": feature_cols,
        "feature_count": len(feature_cols),
    }


class CSVReplayStartRequest(BaseModel):
    uid: str
    name: str
    csv_path: str
    timestamp_column: str = "timestamp"
    channel_labels: list[str] = []
    loop: bool = False
    use_csv_timing: bool = True
    time_scale: float = 1.0
    sample_rate: float = 1.0
    record_file_path: str | None = None
    record_format: str = "csv"


@app.get("/csv-replays/metadata")
def get_csv_replay_metadata(path: str, timestamp_column: str = "timestamp"):
    try:
        return {
            "ok": True,
            **CSVReplaySensor.describe_csv(path, timestamp_column=timestamp_column),
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/csv-replays/start")
def start_csv_replay(req: CSVReplayStartRequest):
    if req.uid in _csv_replays and _csv_replays[req.uid].get("running"):
        return {"ok": True, "uid": req.uid, "note": "already running"}

    info = CSVReplaySensor.describe_csv(
        req.csv_path,
        timestamp_column=req.timestamp_column,
        requested_labels=req.channel_labels or None,
    )
    resolved_csv_path = info["path"]

    state = {
        "uid": req.uid,
        "name": req.name,
        "csv_path": resolved_csv_path,
        "stream_name": req.name,
        "running": False,
        "completed": False,
        "saved_to": None,
        "error": "",
        "record_file_path": req.record_file_path,
        "record_format": req.record_format,
    }
    _csv_replays[req.uid] = state

    def handle_complete():
        state["running"] = False
        state["completed"] = True
        state["error"] = ""
        try:
            state["saved_to"] = session.stop_recording()
        except Exception as exc:
            state["error"] = str(exc)
            logging.warning(f"Failed to stop recording after CSV replay completion: {exc}")
        try:
            if session.status == "Online":
                session.refresh()
        except Exception as exc:
            logging.warning(f"Failed to refresh session after CSV replay completion: {exc}")

    sensor = CSVReplaySensor(
        uid=req.uid,
        name=req.name,
        type="Replay",
        channels=info["channels"],
        sample_rate=0.0 if req.use_csv_timing else req.sample_rate,
        channel_labels=info["channel_labels"],
        csv_path=resolved_csv_path,
        timestamp_column=req.timestamp_column,
        loop=req.loop,
        use_csv_timing=req.use_csv_timing,
        time_scale=req.time_scale,
        on_complete=handle_complete,
    )

    try:
        sensor.start()
        state["running"] = True
        state["completed"] = False
        state["sensor"] = sensor

        if session.status == "Online":
            session.refresh()

        session.start_recording(file_path=req.record_file_path, fmt=req.record_format)
    except Exception as exc:
        state["running"] = False
        state["completed"] = False
        state["error"] = str(exc)
        try:
            sensor.stop()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "ok": True,
        "uid": req.uid,
        "name": req.name,
        "stream": {
            "name": req.name,
            "type": "Replay",
            "channels": info["channels"],
            "rate": 0.0 if req.use_csv_timing else req.sample_rate,
            "channel_labels": info["channel_labels"],
        },
        "csv_path": resolved_csv_path,
        "recording": True,
    }


@app.get("/csv-replays/{uid}")
def get_csv_replay_status(uid: str):
    state = _csv_replays.get(uid)
    if state is None:
        raise HTTPException(status_code=404, detail=f"No CSV replay with uid '{uid}'")

    sensor = state.get("sensor")
    running = bool(sensor._running) if sensor is not None else bool(state.get("running"))
    completed = bool(getattr(sensor, "_completed", False)) if sensor is not None else bool(state.get("completed"))
    state["running"] = running
    state["completed"] = completed

    return {
        "ok": True,
        "uid": uid,
        "name": state["name"],
        "csv_path": state["csv_path"],
        "running": running,
        "completed": completed,
        "saved_to": state.get("saved_to"),
        "error": state.get("error", ""),
        "recording": session._recording,
    }


@app.delete("/csv-replays/{uid}")
def stop_csv_replay(uid: str):
    state = _csv_replays.get(uid)
    if state is None:
        return {"ok": False, "error": f"No CSV replay with uid '{uid}'"}

    sensor = state.get("sensor")
    if sensor is not None:
        try:
            sensor.stop()
        except Exception as exc:
            logging.warning(f"Failed to stop CSV replay '{uid}': {exc}")

    state["running"] = False
    if session._recording:
        state["saved_to"] = session.stop_recording()

    try:
        if session.status == "Online":
            session.refresh()
    except Exception as exc:
        logging.warning(f"Failed to refresh session after CSV replay stop: {exc}")

    return {"ok": True, "uid": uid, "saved_to": state.get("saved_to")}


@app.post("/ml-sensors/start")
def start_ml_sensor(req: MLSensorStartRequest):
    if req.uid in _ml_sensors:
        return {"ok": True, "uid": req.uid, "note": "already running"}

    source_names = [s.strip() for s in req.source_names if str(s).strip()]
    if req.source_name.strip() and req.source_name.strip() not in source_names:
        source_names.insert(0, req.source_name.strip())
    if not source_names:
        raise HTTPException(status_code=400, detail="At least one source stream is required")

    sensor = MLPredictionSensor(
        uid=req.uid,
        name=req.name,
        type="ML",
        channels=1,           # adjusted automatically in _setup
        sample_rate=req.sample_rate,
        source_name=source_names[0],
        source_names=source_names,
        source_type=req.source_type,
        buffer_seconds=req.buffer_seconds,
        process_interval=req.process_interval,
        model_path=req.model_path,
        feature_aliases=req.feature_aliases,
    )
    try:
        sensor.start()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _ml_sensors[req.uid] = sensor

    if session.status == "Online":
        try:
            session.refresh()
        except Exception as exc:
            logging.warning(f"Failed to refresh session after ML sensor start: {exc}")

    return {
        "ok": True,
        "uid": req.uid,
        "name": req.name,
        "source_names": source_names,
        "feature_aliases": req.feature_aliases,
    }


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
                "source_names": getattr(s, "source_names", [s.source_name]),
                "model_path": s.model_path,
                "feature_aliases": getattr(s, "feature_aliases", {}),
                "channels": s.channels,
                "running": s._running,
            }
            for uid, s in _ml_sensors.items()
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

