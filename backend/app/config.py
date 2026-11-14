"""Configuration constants and paths for ASTRA offline-first backend."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = BASE_DIR / "backend"
DATA_DIR = BASE_DIR / "data"
DEMO_DATA_DIR = DATA_DIR / "demo"
UPLOADS_DIR = DATA_DIR / "uploads"
OVERLAYS_DIR = DATA_DIR / "overlays"
MODELS_DIR = DATA_DIR / "models"
DB_PATH = BACKEND_DIR / "astra.db"

for directory in (DATA_DIR, DEMO_DATA_DIR, UPLOADS_DIR, OVERLAYS_DIR, MODELS_DIR):
    directory.mkdir(parents=True, exist_ok=True)

# Scientific & MVP demo threshold constants (explicitly marked as demonstration thresholds,
# NOT validated NASA clinical criteria).
VISION_THRESHOLDS = {
    "min_width": 240,
    "min_height": 240,
    "min_laplacian_sharpness": 35.0,
    "min_brightness": 40.0,
    "max_brightness": 235.0,
    "max_head_yaw_deg": 22.0,
    "max_head_roll_deg": 18.0,
    "periorbital_yellow_pct": 8.0,
    "periorbital_red_pct": 16.0,
    "redness_yellow_pct": 15.0,
    "redness_red_pct": 30.0,
}

AUDIO_THRESHOLDS = {
    "min_duration_sec": 1.2,
    "min_rms_energy": 0.004,
    "max_clipping_ratio": 0.08,
    "pause_yellow_pct": 18.0,
    "pause_red_pct": 35.0,
    "speech_rate_yellow_pct": 18.0,
    "speech_rate_red_pct": 32.0,
}

WHISPER_MODEL_SIZE = "tiny.en"
