"""ASTRA FastAPI application entrypoint."""

from contextlib import asynccontextmanager
import os
from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Set writable Matplotlib cache dir before importing audio/librosa stack
os.environ.setdefault("MPLCONFIGDIR", "/tmp/astra-mpl")

from .config import DB_PATH, DEMO_DATA_DIR, MODELS_DIR, OVERLAYS_DIR, UPLOADS_DIR
from .database import db_session, init_db
from .routes import astronauts, cognitive, digital_twin, intelligence, vision
from .services.seed_service import seed_demo_data


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db(DB_PATH)
    seed_demo_data(DB_PATH)
    yield


app = FastAPI(
    title="ASTRA — Autonomous Spaceflight Health Intelligence API",
    version="1.0.0-mvp",
    description="Offline-first autonomous astronaut monitoring backend (SQLite + OpenCV/MediaPipe + Librosa/Whisper).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(astronauts.router)
app.include_router(vision.router)
app.include_router(cognitive.router)
app.include_router(intelligence.router)
app.include_router(digital_twin.router)

app.mount("/api/media/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/api/media/overlays", StaticFiles(directory=str(OVERLAYS_DIR)), name="overlays")
app.mount("/api/media/demo", StaticFiles(directory=str(DEMO_DATA_DIR)), name="demo")


@app.get("/api/system/status")
def get_system_status() -> Dict:
    with db_session(DB_PATH) as conn:
        queue_rows = conn.execute(
            "SELECT id, astronaut_id, module, payload_summary, status, created_at FROM offline_sync_queue ORDER BY id DESC LIMIT 12"
        ).fetchall()
        total_queued = conn.execute("SELECT COUNT(*) FROM offline_sync_queue").fetchone()[0]

    whisper_ready = (MODELS_DIR / "whisper").exists() and any((MODELS_DIR / "whisper").iterdir())
    mediapipe_ready = (MODELS_DIR / "face_landmarker.task").exists()

    return {
        "mode": "LOCAL / OFFLINE-FIRST",
        "database_path": str(DB_PATH),
        "mediapipe_model_ready": mediapipe_ready,
        "whisper_offline_ready": whisper_ready,
        "offline_sync_queued_count": int(total_queued),
        "recent_sync_queue": [dict(r) for r in queue_rows],
    }
