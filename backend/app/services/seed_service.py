"""Deterministic demo seed service for AST-001 (explicitly marked DEMO / SYNTHETIC)."""

from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path

from ..config import DB_PATH, DEMO_DATA_DIR
from ..database import db_session, init_db


def _iso_days_ago(days_ago: int, hour: int = 8) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    dt = dt.replace(hour=hour, minute=0, second=0, microsecond=0)
    return dt.isoformat().replace("+00:00", "Z")


def seed_demo_data(db_path: Path = DB_PATH) -> None:
    """Ensure AST-001 demo profile, baseline, and synthetic 30-day history exist."""
    init_db(db_path)

    with db_session(db_path) as conn:
        existing = conn.execute(
            "SELECT astronaut_id FROM astronauts WHERE astronaut_id = ?", ("AST-001",)
        ).fetchone()
        if existing is not None:
            return

        now_iso = _iso_days_ago(0, hour=9)
        created_iso = _iso_days_ago(30, hour=7)

        conn.execute(
            """
            INSERT INTO astronauts (
                astronaut_id, name, age, height_cm, weight_kg,
                mission_name, mission_type, mission_day, blood_type,
                medical_history, allergies, medications, medical_notes,
                is_synthetic_seed, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "AST-001",
                "Cmdr. Elena Vance",
                38,
                173.0,
                64.5,
                "Artemis Orbital Endurance-IV",
                "Long-Duration Orbital / Lunar Transit",
                30,
                "O-",
                "Mild transient space adaptation motion sensitivity (Days 1-3, resolved). Normal pre-flight ocular OCT baseline.",
                "None known",
                "Vitamin D3 1000 IU daily; scheduled resistive exercise protocol.",
                "DEMO / SYNTHETIC crew profile for autonomous baseline-relative monitoring.",
                1,
                created_iso,
                now_iso,
            ),
        )

        conn.execute(
            """
            INSERT INTO baselines (
                astronaut_id, resting_heart_rate_bpm, sleep_hours, sleep_quality_score,
                activity_minutes, hydration_liters, nutrition_score,
                reaction_time_ms, memory_score, attention_score,
                periorbital_index, eye_redness_index,
                speech_rate_wpm, pause_duration_sec, voice_energy_rms, voice_variability,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "AST-001",
                61.0,
                7.6,
                88.0,
                78.0,
                2.7,
                90.0,
                258.0,
                92.0,
                93.0,
                100.0,
                12.0,
                142.0,
                0.38,
                0.062,
                24.0,
                created_iso,
            ),
        )

        # 30 days of realistic synthetic mission telemetry showing mild late-mission workload & sleep compression
        for day in range(1, 31):
            days_ago = 30 - day
            late_drift = max(0, day - 22) / 8.0
            wave = math.sin(day * 0.65)
            rhr = round(61.0 + 1.2 * wave + 4.8 * late_drift, 1)
            sleep_h = round(7.6 + 0.25 * math.cos(day * 0.5) - 1.15 * late_drift, 2)
            sleep_q = round(max(55.0, min(96.0, 88.0 + 3.0 * wave - 14.0 * late_drift)), 1)
            activity = round(max(35.0, 78.0 + 8.0 * math.sin(day * 0.9) - 14.0 * late_drift), 1)
            hydration = round(max(1.7, 2.7 + 0.15 * wave - 0.35 * late_drift), 2)
            nutrition = round(max(68.0, 90.0 + 2.0 * wave - 7.0 * late_drift), 1)
            workload = round(min(94.0, 58.0 + 5.0 * wave + 24.0 * late_drift), 1)
            radiation = round(0.62 + 0.08 * abs(wave) + 0.12 * late_drift, 2)
            mood = "Focused" if day < 25 else "Mildly Fatigued"
            fatigue = 3 if day < 24 else min(8, int(4 + round(3 * late_drift)))

            conn.execute(
                """
                INSERT INTO telemetry_records (
                    astronaut_id, mission_day, timestamp, resting_heart_rate_bpm,
                    sleep_hours, sleep_quality_score, activity_minutes,
                    hydration_liters, nutrition_score, workload_index, radiation_msv_day,
                    self_report_mood, self_report_fatigue, is_synthetic
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "AST-001",
                    day,
                    _iso_days_ago(days_ago, hour=7),
                    rhr,
                    sleep_h,
                    sleep_q,
                    activity,
                    hydration,
                    nutrition,
                    workload,
                    radiation,
                    mood,
                    fatigue,
                    1,
                ),
            )

        # Seed historical cognitive test snapshots (Days 5, 15, 25, 29)
        test_seeds = [
            (25, "reaction_time", 259.0, "ms", 100.0, 258.0, 0.4, 0),
            (15, "reaction_time", 264.0, "ms", 100.0, 258.0, 2.3, 0),
            (5, "reaction_time", 279.0, "ms", 96.0, 258.0, 8.1, 0),
            (1, "reaction_time", 296.0, "ms", 94.0, 258.0, 14.7, 1),
            (15, "memory", 91.0, "percent", 91.0, 92.0, -1.1, 0),
            (2, "memory", 84.0, "percent", 84.0, 92.0, -8.7, 0),
            (15, "attention", 93.0, "percent", 93.0, 93.0, 0.0, 0),
            (1, "attention", 81.0, "percent", 81.0, 93.0, -12.9, 1),
        ]
        for days_ago, ttype, score, unit, acc, base_v, chg, anom in test_seeds:
            conn.execute(
                """
                INSERT INTO cognitive_test_results (
                    astronaut_id, test_type, timestamp, score, unit,
                    accuracy_percent, baseline_value, change_percent,
                    anomaly_detected, metadata_json, is_synthetic
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "AST-001",
                    ttype,
                    _iso_days_ago(days_ago, hour=14),
                    score,
                    unit,
                    acc,
                    base_v,
                    chg,
                    anom,
                    json.dumps({"source": "demo_mission_log"}),
                    1,
                ),
            )
