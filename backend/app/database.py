"""SQLite database initialization and connection helpers for ASTRA."""

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import DB_PATH


SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS astronauts (
    astronaut_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    height_cm REAL NOT NULL,
    weight_kg REAL NOT NULL,
    mission_name TEXT NOT NULL,
    mission_type TEXT NOT NULL,
    mission_day INTEGER NOT NULL,
    blood_type TEXT NOT NULL,
    medical_history TEXT NOT NULL,
    allergies TEXT NOT NULL,
    medications TEXT NOT NULL,
    medical_notes TEXT NOT NULL,
    is_synthetic_seed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS baselines (
    astronaut_id TEXT PRIMARY KEY,
    resting_heart_rate_bpm REAL NOT NULL,
    sleep_hours REAL NOT NULL,
    sleep_quality_score REAL NOT NULL,
    activity_minutes REAL NOT NULL,
    hydration_liters REAL NOT NULL,
    nutrition_score REAL NOT NULL,
    reaction_time_ms REAL NOT NULL,
    memory_score REAL NOT NULL,
    attention_score REAL NOT NULL,
    periorbital_index REAL NOT NULL,
    eye_redness_index REAL NOT NULL,
    speech_rate_wpm REAL NOT NULL,
    pause_duration_sec REAL NOT NULL,
    voice_energy_rms REAL NOT NULL,
    voice_variability REAL NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (astronaut_id) REFERENCES astronauts(astronaut_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS telemetry_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    mission_day INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    resting_heart_rate_bpm REAL NOT NULL,
    sleep_hours REAL NOT NULL,
    sleep_quality_score REAL NOT NULL,
    activity_minutes REAL NOT NULL,
    hydration_liters REAL NOT NULL,
    nutrition_score REAL NOT NULL,
    workload_index REAL NOT NULL,
    radiation_msv_day REAL NOT NULL,
    self_report_mood TEXT,
    self_report_fatigue INTEGER,
    is_synthetic INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (astronaut_id) REFERENCES astronauts(astronaut_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vision_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL,
    error_code TEXT,
    error_detail TEXT,
    image_quality REAL NOT NULL,
    measurements_json TEXT NOT NULL,
    baseline_comparison_json TEXT NOT NULL,
    anomalies_json TEXT NOT NULL,
    requires_follow_up INTEGER NOT NULL DEFAULT 0,
    source_image_url TEXT,
    overlay_image_url TEXT,
    is_synthetic INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (astronaut_id) REFERENCES astronauts(astronaut_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cognitive_audio_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL,
    error_code TEXT,
    error_detail TEXT,
    data_quality REAL NOT NULL,
    transcript TEXT NOT NULL,
    transcription_engine TEXT NOT NULL,
    measurements_json TEXT NOT NULL,
    baseline_comparison_json TEXT NOT NULL,
    anomalies_json TEXT NOT NULL,
    is_synthetic INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (astronaut_id) REFERENCES astronauts(astronaut_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cognitive_test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    test_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    score REAL NOT NULL,
    unit TEXT NOT NULL,
    accuracy_percent REAL,
    baseline_value REAL NOT NULL,
    change_percent REAL NOT NULL,
    anomaly_detected INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL,
    is_synthetic INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (astronaut_id) REFERENCES astronauts(astronaut_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intelligence_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    overall_status TEXT NOT NULL,
    risk_score REAL NOT NULL,
    data_completeness REAL NOT NULL,
    detected_signals_json TEXT NOT NULL,
    missing_signals_json TEXT NOT NULL,
    signal_qualities_json TEXT NOT NULL,
    explanation TEXT NOT NULL,
    recommended_next_steps_json TEXT NOT NULL,
    requires_human_review INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (astronaut_id) REFERENCES astronauts(astronaut_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    module TEXT NOT NULL,
    payload_summary TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued_offline',
    created_at TEXT NOT NULL
);
"""


def get_connection(db_path=DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def db_session(db_path=DB_PATH) -> Iterator[sqlite3.Connection]:
    conn = get_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path=DB_PATH) -> None:
    with db_session(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
