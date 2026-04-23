





#ECHO Backend — FastAPI Application

#Main entry point for the backend server.
#Uses SessionManager for all LSL/WebSocket logic.


import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from dashboard.session_manager import SessionManager
from machine_learning.router import router as ml_router
import os
import pandas as pd

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
@app.post("/record/start")
def start_recording():
    session.start_recording()
    return {"recording": True}


@app.post("/record/stop")
def stop_recording():
    session.stop_recording()
    return {"recording": False}

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)






# The folder you want to list
STORAGE_PATH = './CSV'

@app.get("/")
def hello():
    return "Hello, World!"

@app.get('/CSV')
def list_files():
    # Get all file names in the directory
    try:
        files = os.listdir(STORAGE_PATH)
        return {"file_list": files}
    except FileNotFoundError:
        return {"error": "Directory not found"}, 404


@app.route('/ML/')
async def read_user_item(path: str):
##seperate pd.read function from app.py later
    try:
        df = pd.read_csv(STORAGE_PATH + '/'  + path )
        columns = df.columns.to_list()
        return columns
    except:
        print('test for multiple file types')
    try:
        df = pd.read_excel(STORAGE_PATH + '/' + path)
        columns = df.columns.to_list()
        return columns
    except:
        print('this failed too boohoo')
        return {"error": "Invalid file type"}, 400


