"""Routes for Cognitive Monitoring (Audio Analysis + Controlled Cognitive Tests)."""

from datetime import datetime, timezone
import json
from typing import Dict, List

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from ..config import DEMO_DATA_DIR
from ..database import db_session
from ..schemas.cognitive import (
    AudioMeasurements,
    CognitiveAudioResponse,
    CognitiveTestResponse,
    CognitiveTestSubmit,
)
from ..services.audio_service import analyze_cognitive_audio

router = APIRouter(prefix="/api/cognitive", tags=["cognitive"])


@router.post("/analyze", response_model=CognitiveAudioResponse)
async def analyze_audio(
    astronaut_id: str = Form("AST-001"),
    is_synthetic: bool = Form(False),
    file: UploadFile = File(...),
) -> CognitiveAudioResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")
    try:
        return analyze_cognitive_audio(
            astronaut_id=astronaut_id,
            audio_bytes=content,
            filename=file.filename or "recording.wav",
            is_synthetic=is_synthetic,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/analyze-demo", response_model=CognitiveAudioResponse)
def analyze_demo_audio(
    astronaut_id: str = Query("AST-001"),
    sample: str = Query("clean", pattern="^(clean|noisy)$"),
) -> CognitiveAudioResponse:
    sample_map = {
        "clean": DEMO_DATA_DIR / "ast001_voice_sample.wav",
        "noisy": DEMO_DATA_DIR / "ast001_noisy_clip.wav",
    }
    path = sample_map[sample]
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Demo audio sample '{sample}' not found.")
    try:
        return analyze_cognitive_audio(
            astronaut_id=astronaut_id,
            audio_bytes=path.read_bytes(),
            filename=path.name,
            is_synthetic=True,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/test-result", response_model=CognitiveTestResponse, status_code=201)
def save_cognitive_test_result(payload: CognitiveTestSubmit) -> CognitiveTestResponse:
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with db_session() as conn:
        baseline = conn.execute(
            "SELECT reaction_time_ms, memory_score, attention_score FROM baselines WHERE astronaut_id = ?",
            (payload.astronaut_id,),
        ).fetchone()
        if baseline is None:
            raise HTTPException(status_code=404, detail=f"Astronaut '{payload.astronaut_id}' not found.")

        base_map = {
            "reaction_time": float(baseline["reaction_time_ms"]),
            "memory": float(baseline["memory_score"]),
            "attention": float(baseline["attention_score"]),
        }
        base_val = base_map[payload.test_type]
        chg_pct = round(((payload.score - base_val) / max(1.0, base_val)) * 100.0, 2)

        if payload.test_type == "reaction_time":
            anomaly = chg_pct >= 15.0
        else:
            anomaly = chg_pct <= -12.0

        cur = conn.execute(
            """
            INSERT INTO cognitive_test_results (
                astronaut_id, test_type, timestamp, score, unit,
                accuracy_percent, baseline_value, change_percent,
                anomaly_detected, metadata_json, is_synthetic
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.astronaut_id,
                payload.test_type,
                now_iso,
                payload.score,
                payload.unit,
                payload.accuracy_percent,
                base_val,
                chg_pct,
                1 if anomaly else 0,
                json.dumps(payload.metadata),
                1 if payload.is_synthetic else 0,
            ),
        )
        new_id = int(cur.lastrowid)
        conn.execute(
            """
            INSERT INTO offline_sync_queue (astronaut_id, module, payload_summary, status, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                payload.astronaut_id,
                "cognitive_test",
                f"{payload.test_type}={payload.score}{payload.unit} ({chg_pct:+.1f}%)",
                "queued_offline",
                now_iso,
            ),
        )

    return CognitiveTestResponse(
        id=new_id,
        astronaut_id=payload.astronaut_id,
        test_type=payload.test_type,
        timestamp=now_iso,
        score=payload.score,
        unit=payload.unit,
        accuracy_percent=payload.accuracy_percent,
        baseline_value=base_val,
        change_percent=chg_pct,
        anomaly_detected=anomaly,
        is_synthetic=payload.is_synthetic,
    )


@router.get("/{astronaut_id}/history", response_model=Dict)
def get_cognitive_history(astronaut_id: str) -> Dict:
    with db_session() as conn:
        audio_rows = conn.execute(
            "SELECT * FROM cognitive_audio_analyses WHERE astronaut_id = ? ORDER BY id DESC LIMIT 15",
            (astronaut_id,),
        ).fetchall()
        test_rows = conn.execute(
            "SELECT * FROM cognitive_test_results WHERE astronaut_id = ? ORDER BY id DESC LIMIT 30",
            (astronaut_id,),
        ).fetchall()

    audios = [
        CognitiveAudioResponse(
            id=int(r["id"]),
            astronaut_id=r["astronaut_id"],
            timestamp=r["timestamp"],
            status=r["status"],
            error_code=r["error_code"],
            error_detail=r["error_detail"],
            data_quality=float(r["data_quality"]),
            transcript=r["transcript"],
            transcription_engine=r["transcription_engine"],
            measurements=AudioMeasurements(**json.loads(r["measurements_json"])),
            baseline_comparison=json.loads(r["baseline_comparison_json"]),
            anomalies=json.loads(r["anomalies_json"]),
            is_synthetic=bool(r["is_synthetic"]),
        ).model_dump()
        for r in audio_rows
    ]

    tests = [
        CognitiveTestResponse(
            id=int(r["id"]),
            astronaut_id=r["astronaut_id"],
            test_type=r["test_type"],
            timestamp=r["timestamp"],
            score=float(r["score"]),
            unit=r["unit"],
            accuracy_percent=r["accuracy_percent"],
            baseline_value=float(r["baseline_value"]),
            change_percent=float(r["change_percent"]),
            anomaly_detected=bool(r["anomaly_detected"]),
            is_synthetic=bool(r["is_synthetic"]),
        ).model_dump()
        for r in test_rows
    ]

    return {"audio_analyses": audios, "test_results": tests}
