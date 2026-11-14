"""End-to-end backend smoke & integration tests for ASTRA."""

import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import db_session  # noqa: E402
from app.main import app  # noqa: E402


def _cleanup_test_astronaut(aid: str = "AST-999") -> None:
    with db_session() as conn:
        for table in (
            "baselines",
            "telemetry_records",
            "vision_analyses",
            "cognitive_audio_analyses",
            "cognitive_test_results",
            "intelligence_reports",
            "offline_sync_queue",
            "astronauts",
        ):
            conn.execute(f"DELETE FROM {table} WHERE astronaut_id = ?", (aid,))


def test_full_astra_backend_pipeline():
    _cleanup_test_astronaut("AST-999")
    try:
        with TestClient(app) as client:
            # 1. System offline status
            sys_res = client.get("/api/system/status")
            assert sys_res.status_code == 200
            sys_data = sys_res.json()
            assert sys_data["mode"] == "LOCAL / OFFLINE-FIRST"
            assert sys_data["mediapipe_model_ready"] is True
            assert sys_data["whisper_offline_ready"] is True

            # 2. Seeded AST-001 profile + 30-day synthetic history
            ast_res = client.get("/api/astronauts/AST-001")
            assert ast_res.status_code == 200
            ast_data = ast_res.json()
            assert ast_data["astronaut_id"] == "AST-001"
            assert ast_data["mission_day"] == 30
            assert ast_data["is_synthetic_seed"] is True
            assert len(ast_data["telemetry_history"]) >= 30

            # 3. Create AST-999 & test missing-signal resilience
            create_res = client.post(
                "/api/astronauts",
                json={
                    "astronaut_id": "AST-999",
                    "name": "Dr. Marcus Chen",
                    "age": 41,
                    "height_cm": 178,
                    "weight_kg": 74,
                    "mission_name": "Lunar Gateway Prep",
                    "mission_day": 5,
                },
            )
            assert create_res.status_code == 201

            intel_sparse = client.post("/api/intelligence/run", json={"astronaut_id": "AST-999"})
            assert intel_sparse.status_code == 200
            sparse_data = intel_sparse.json()
            assert "vision_monitoring" in sparse_data["missing_signals"]
            assert "cognitive_audio" in sparse_data["missing_signals"]

            # 4. Vision Monitoring: real MediaPipe analysis on followup demo portrait
            v_good = client.post("/api/vision/analyze-demo?astronaut_id=AST-001&sample=followup")
            assert v_good.status_code == 200
            vg_data = v_good.json()
            assert vg_data["status"] == "ok"
            assert vg_data["image_quality"] > 0.5
            assert vg_data["measurements"]["periorbital_index"] is not None
            assert vg_data["overlay_image_url"] is not None

            # 5. Vision Monitoring: poor blurry image rejection
            v_poor = client.post("/api/vision/analyze-demo?astronaut_id=AST-001&sample=poor")
            assert v_poor.status_code == 200
            vp_data = v_poor.json()
            assert vp_data["status"] in ("no_face_detected", "low_image_quality")

            # 6. Cognitive Audio: real Librosa + Whisper offline transcription
            a_clean = client.post("/api/cognitive/analyze-demo?astronaut_id=AST-001&sample=clean")
            assert a_clean.status_code == 200
            ac_data = a_clean.json()
            assert ac_data["status"] == "ok"
            assert ac_data["measurements"]["speech_rate_wpm"] > 40
            assert len(ac_data["transcript"]) > 10

            # 7. Cognitive Audio: noisy audio rejection
            a_noisy = client.post("/api/cognitive/analyze-demo?astronaut_id=AST-001&sample=noisy")
            assert a_noisy.status_code == 200
            assert a_noisy.json()["status"] == "noisy_audio"

            # 8. Controlled Cognitive Test submission
            test_res = client.post(
                "/api/cognitive/test-result",
                json={
                    "astronaut_id": "AST-001",
                    "test_type": "reaction_time",
                    "score": 310.0,
                    "unit": "ms",
                    "trials_count": 5,
                    "accuracy_percent": 100.0,
                },
            )
            assert test_res.status_code == 201
            assert test_res.json()["change_percent"] > 0

            # 9. Health Intelligence multi-signal fusion on AST-001
            intel_res = client.post(
                "/api/intelligence/run",
                json={"astronaut_id": "AST-001", "include_self_report_note": "Slight eye strain after EVA prep"},
            )
            assert intel_res.status_code == 200
            intel_data = intel_res.json()
            assert intel_data["overall_status"] in ("Green", "Yellow", "Red")
            assert intel_data["data_completeness"] == 1.0
            assert len(intel_data["recommended_next_steps"]) >= 2

            # 10. Digital Twin forecast & What-if simulation
            fc_res = client.get("/api/digital-twin/AST-001/forecast")
            assert fc_res.status_code == 200
            fc_data = fc_res.json()
            assert len(fc_data["history_and_forecast"]) >= 15

            sim_res = client.post(
                "/api/digital-twin/simulate",
                json={
                    "astronaut_id": "AST-001",
                    "sleep_hours": 8.5,
                    "exercise_minutes": 75.0,
                    "nutrition_score": 92.0,
                    "hydration_liters": 2.9,
                    "workload_index": 45.0,
                },
            )
            assert sim_res.status_code == 200
            sim_data = sim_res.json()
            assert sim_data["day_14_delta"]["cognitive_readiness_delta"] > 0
    finally:
        _cleanup_test_astronaut("AST-999")
