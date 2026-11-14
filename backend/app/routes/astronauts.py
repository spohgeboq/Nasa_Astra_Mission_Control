"""Routes for Astronaut Profile, Baseline, and Telemetry History."""

from datetime import datetime, timezone
from typing import Dict, List
import uuid

from fastapi import APIRouter, HTTPException

from ..database import db_session
from ..schemas.astronaut import (
    AstronautCreate,
    AstronautProfileResponse,
    AstronautUpdate,
    BaselineProfile,
    TelemetryPoint,
    TelemetryPointCreate,
)

router = APIRouter(prefix="/api/astronauts", tags=["astronauts"])


def _row_to_baseline(row) -> BaselineProfile:
    return BaselineProfile(
        resting_heart_rate_bpm=row["resting_heart_rate_bpm"],
        sleep_hours=row["sleep_hours"],
        sleep_quality_score=row["sleep_quality_score"],
        activity_minutes=row["activity_minutes"],
        hydration_liters=row["hydration_liters"],
        nutrition_score=row["nutrition_score"],
        reaction_time_ms=row["reaction_time_ms"],
        memory_score=row["memory_score"],
        attention_score=row["attention_score"],
        periorbital_index=row["periorbital_index"],
        eye_redness_index=row["eye_redness_index"],
        speech_rate_wpm=row["speech_rate_wpm"],
        pause_duration_sec=row["pause_duration_sec"],
        voice_energy_rms=row["voice_energy_rms"],
        voice_variability=row["voice_variability"],
    )


def _load_profile(astronaut_id: str) -> AstronautProfileResponse:
    with db_session() as conn:
        a = conn.execute(
            "SELECT * FROM astronauts WHERE astronaut_id = ?", (astronaut_id,)
        ).fetchone()
        if a is None:
            raise HTTPException(status_code=404, detail=f"Astronaut '{astronaut_id}' not found.")

        b = conn.execute(
            "SELECT * FROM baselines WHERE astronaut_id = ?", (astronaut_id,)
        ).fetchone()
        t_rows = conn.execute(
            """
            SELECT * FROM telemetry_records
            WHERE astronaut_id = ?
            ORDER BY mission_day ASC, id ASC
            """,
            (astronaut_id,),
        ).fetchall()

    telemetry = [
        TelemetryPoint(
            id=int(r["id"]),
            astronaut_id=r["astronaut_id"],
            mission_day=int(r["mission_day"]),
            timestamp=r["timestamp"],
            resting_heart_rate_bpm=float(r["resting_heart_rate_bpm"]),
            sleep_hours=float(r["sleep_hours"]),
            sleep_quality_score=float(r["sleep_quality_score"]),
            activity_minutes=float(r["activity_minutes"]),
            hydration_liters=float(r["hydration_liters"]),
            nutrition_score=float(r["nutrition_score"]),
            workload_index=float(r["workload_index"]),
            radiation_msv_day=float(r["radiation_msv_day"]),
            self_report_mood=r["self_report_mood"],
            self_report_fatigue=r["self_report_fatigue"],
            is_synthetic=bool(r["is_synthetic"]),
        )
        for r in t_rows
    ]

    return AstronautProfileResponse(
        astronaut_id=a["astronaut_id"],
        name=a["name"],
        age=int(a["age"]),
        height_cm=float(a["height_cm"]),
        weight_kg=float(a["weight_kg"]),
        mission_name=a["mission_name"],
        mission_type=a["mission_type"],
        mission_day=int(a["mission_day"]),
        blood_type=a["blood_type"],
        medical_history=a["medical_history"],
        allergies=a["allergies"],
        medications=a["medications"],
        medical_notes=a["medical_notes"],
        created_at=a["created_at"],
        updated_at=a["updated_at"],
        is_synthetic_seed=bool(a["is_synthetic_seed"]),
        baseline=_row_to_baseline(b) if b else BaselineProfile(),
        telemetry_history=telemetry,
    )


@router.get("", response_model=List[Dict])
def list_astronauts() -> List[Dict]:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT astronaut_id, name, mission_name, mission_day, is_synthetic_seed FROM astronauts ORDER BY astronaut_id ASC"
        ).fetchall()
        results = []
        for r in rows:
            aid = r["astronaut_id"]
            latest_intel = conn.execute(
                "SELECT overall_status, risk_score, timestamp FROM intelligence_reports WHERE astronaut_id = ? ORDER BY id DESC LIMIT 1",
                (aid,),
            ).fetchone()
            results.append(
                {
                    "astronaut_id": aid,
                    "name": r["name"],
                    "mission_name": r["mission_name"],
                    "mission_day": int(r["mission_day"]),
                    "is_synthetic_seed": bool(r["is_synthetic_seed"]),
                    "latest_status": latest_intel["overall_status"] if latest_intel else "Green",
                    "latest_risk_score": float(latest_intel["risk_score"]) if latest_intel else 12.0,
                    "last_assessed": latest_intel["timestamp"] if latest_intel else None,
                }
            )
        return results


@router.post("", response_model=AstronautProfileResponse, status_code=201)
def create_astronaut(payload: AstronautCreate) -> AstronautProfileResponse:
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    aid = payload.astronaut_id.strip().upper() if payload.astronaut_id else f"AST-{uuid.uuid4().hex[:3].upper()}"
    base = payload.baseline or BaselineProfile()

    with db_session() as conn:
        exists = conn.execute(
            "SELECT 1 FROM astronauts WHERE astronaut_id = ?", (aid,)
        ).fetchone()
        if exists is not None:
            raise HTTPException(status_code=409, detail=f"Astronaut '{aid}' already exists.")

        conn.execute(
            """
            INSERT INTO astronauts (
                astronaut_id, name, age, height_cm, weight_kg,
                mission_name, mission_type, mission_day, blood_type,
                medical_history, allergies, medications, medical_notes,
                is_synthetic_seed, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (
                aid,
                payload.name,
                payload.age,
                payload.height_cm,
                payload.weight_kg,
                payload.mission_name,
                payload.mission_type,
                payload.mission_day,
                payload.blood_type,
                payload.medical_history,
                payload.allergies,
                payload.medications,
                payload.medical_notes,
                now_iso,
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
                aid,
                base.resting_heart_rate_bpm,
                base.sleep_hours,
                base.sleep_quality_score,
                base.activity_minutes,
                base.hydration_liters,
                base.nutrition_score,
                base.reaction_time_ms,
                base.memory_score,
                base.attention_score,
                base.periorbital_index,
                base.eye_redness_index,
                base.speech_rate_wpm,
                base.pause_duration_sec,
                base.voice_energy_rms,
                base.voice_variability,
                now_iso,
            ),
        )
        conn.execute(
            """
            INSERT INTO telemetry_records (
                astronaut_id, mission_day, timestamp, resting_heart_rate_bpm,
                sleep_hours, sleep_quality_score, activity_minutes,
                hydration_liters, nutrition_score, workload_index, radiation_msv_day,
                self_report_mood, self_report_fatigue, is_synthetic
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 55.0, 0.6, 'Baseline Nominal', 2, 0)
            """,
            (
                aid,
                payload.mission_day,
                now_iso,
                base.resting_heart_rate_bpm,
                base.sleep_hours,
                base.sleep_quality_score,
                base.activity_minutes,
                base.hydration_liters,
                base.nutrition_score,
            ),
        )

    return _load_profile(aid)


@router.get("/{astronaut_id}", response_model=AstronautProfileResponse)
def get_astronaut(astronaut_id: str) -> AstronautProfileResponse:
    return _load_profile(astronaut_id)


@router.put("/{astronaut_id}", response_model=AstronautProfileResponse)
def update_astronaut(astronaut_id: str, payload: AstronautUpdate) -> AstronautProfileResponse:
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return _load_profile(astronaut_id)

    updates["updated_at"] = now_iso
    set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
    values = list(updates.values()) + [astronaut_id]

    with db_session() as conn:
        res = conn.execute(
            f"UPDATE astronauts SET {set_clause} WHERE astronaut_id = ?", values
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Astronaut '{astronaut_id}' not found.")

    return _load_profile(astronaut_id)


@router.put("/{astronaut_id}/baseline", response_model=AstronautProfileResponse)
def update_baseline(astronaut_id: str, payload: BaselineProfile) -> AstronautProfileResponse:
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with db_session() as conn:
        res = conn.execute(
            """
            UPDATE baselines SET
                resting_heart_rate_bpm = ?, sleep_hours = ?, sleep_quality_score = ?,
                activity_minutes = ?, hydration_liters = ?, nutrition_score = ?,
                reaction_time_ms = ?, memory_score = ?, attention_score = ?,
                periorbital_index = ?, eye_redness_index = ?,
                speech_rate_wpm = ?, pause_duration_sec = ?, voice_energy_rms = ?, voice_variability = ?,
                updated_at = ?
            WHERE astronaut_id = ?
            """,
            (
                payload.resting_heart_rate_bpm,
                payload.sleep_hours,
                payload.sleep_quality_score,
                payload.activity_minutes,
                payload.hydration_liters,
                payload.nutrition_score,
                payload.reaction_time_ms,
                payload.memory_score,
                payload.attention_score,
                payload.periorbital_index,
                payload.eye_redness_index,
                payload.speech_rate_wpm,
                payload.pause_duration_sec,
                payload.voice_energy_rms,
                payload.voice_variability,
                now_iso,
                astronaut_id,
            ),
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Astronaut '{astronaut_id}' not found.")

    return _load_profile(astronaut_id)


@router.post("/{astronaut_id}/telemetry", response_model=TelemetryPoint, status_code=201)
def add_telemetry_point(astronaut_id: str, payload: TelemetryPointCreate) -> TelemetryPoint:
    ts = payload.timestamp or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with db_session() as conn:
        exists = conn.execute(
            "SELECT 1 FROM astronauts WHERE astronaut_id = ?", (astronaut_id,)
        ).fetchone()
        if exists is None:
            raise HTTPException(status_code=404, detail=f"Astronaut '{astronaut_id}' not found.")

        cur = conn.execute(
            """
            INSERT INTO telemetry_records (
                astronaut_id, mission_day, timestamp, resting_heart_rate_bpm,
                sleep_hours, sleep_quality_score, activity_minutes,
                hydration_liters, nutrition_score, workload_index, radiation_msv_day,
                self_report_mood, self_report_fatigue, is_synthetic
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                astronaut_id,
                payload.mission_day,
                ts,
                payload.resting_heart_rate_bpm,
                payload.sleep_hours,
                payload.sleep_quality_score,
                payload.activity_minutes,
                payload.hydration_liters,
                payload.nutrition_score,
                payload.workload_index,
                payload.radiation_msv_day,
                payload.self_report_mood,
                payload.self_report_fatigue,
                1 if payload.is_synthetic else 0,
            ),
        )
        conn.execute(
            "UPDATE astronauts SET mission_day = MAX(mission_day, ?), updated_at = ? WHERE astronaut_id = ?",
            (payload.mission_day, ts, astronaut_id),
        )
        new_id = int(cur.lastrowid)

    return TelemetryPoint(
        id=new_id,
        astronaut_id=astronaut_id,
        mission_day=payload.mission_day,
        timestamp=ts,
        resting_heart_rate_bpm=payload.resting_heart_rate_bpm,
        sleep_hours=payload.sleep_hours,
        sleep_quality_score=payload.sleep_quality_score,
        activity_minutes=payload.activity_minutes,
        hydration_liters=payload.hydration_liters,
        nutrition_score=payload.nutrition_score,
        workload_index=payload.workload_index,
        radiation_msv_day=payload.radiation_msv_day,
        self_report_mood=payload.self_report_mood,
        self_report_fatigue=payload.self_report_fatigue,
        is_synthetic=payload.is_synthetic,
    )
