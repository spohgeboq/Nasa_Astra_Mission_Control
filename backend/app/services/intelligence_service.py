"""Multi-signal Health Intelligence fusion engine (deterministic & explainable)."""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import List, Optional

from ..config import AUDIO_THRESHOLDS, DB_PATH, VISION_THRESHOLDS
from ..database import db_session
from ..schemas.common import StatusLevel
from ..schemas.intelligence import (
    DetectedFactor,
    HealthIntelligenceResponse,
    SignalQualityEntry,
)


_SEVERITY_RANK = {"Green": 0, "Yellow": 1, "Red": 2}


def _max_status(a: StatusLevel, b: StatusLevel) -> StatusLevel:
    return a if _SEVERITY_RANK[a] >= _SEVERITY_RANK[b] else b


def run_health_intelligence(
    astronaut_id: str,
    self_report_note: Optional[str] = None,
    db_path: Path = DB_PATH,
) -> HealthIntelligenceResponse:
    """Fuse Vision, Cognitive Audio, Cognitive Tests, and Telemetry against individual baseline."""
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    with db_session(db_path) as conn:
        astronaut = conn.execute(
            "SELECT * FROM astronauts WHERE astronaut_id = ?", (astronaut_id,)
        ).fetchone()
        if astronaut is None:
            raise LookupError(f"Astronaut '{astronaut_id}' not found.")

        baseline = conn.execute(
            "SELECT * FROM baselines WHERE astronaut_id = ?", (astronaut_id,)
        ).fetchone()
        if baseline is None:
            raise LookupError(f"Baseline for '{astronaut_id}' not found.")

        latest_telemetry = conn.execute(
            """
            SELECT * FROM telemetry_records
            WHERE astronaut_id = ?
            ORDER BY mission_day DESC, id DESC LIMIT 1
            """,
            (astronaut_id,),
        ).fetchone()

        latest_vision = conn.execute(
            """
            SELECT * FROM vision_analyses
            WHERE astronaut_id = ? AND status = 'ok'
            ORDER BY id DESC LIMIT 1
            """,
            (astronaut_id,),
        ).fetchone()
        if latest_vision is None:
            latest_vision = conn.execute(
                """
                SELECT * FROM vision_analyses
                WHERE astronaut_id = ?
                ORDER BY id DESC LIMIT 1
                """,
                (astronaut_id,),
            ).fetchone()

        latest_audio = conn.execute(
            """
            SELECT * FROM cognitive_audio_analyses
            WHERE astronaut_id = ? AND status = 'ok'
            ORDER BY id DESC LIMIT 1
            """,
            (astronaut_id,),
        ).fetchone()
        if latest_audio is None:
            latest_audio = conn.execute(
                """
                SELECT * FROM cognitive_audio_analyses
                WHERE astronaut_id = ?
                ORDER BY id DESC LIMIT 1
                """,
                (astronaut_id,),
            ).fetchone()

        latest_tests = {}
        for ttype in ("reaction_time", "memory", "attention"):
            row = conn.execute(
                """
                SELECT * FROM cognitive_test_results
                WHERE astronaut_id = ? AND test_type = ?
                ORDER BY id DESC LIMIT 1
                """,
                (astronaut_id, ttype),
            ).fetchone()
            if row is not None:
                latest_tests[ttype] = row

    detected: List[DetectedFactor] = []
    missing_signals: List[str] = []
    qualities: List[SignalQualityEntry] = []
    overall_status: StatusLevel = "Green"
    risk_points = 8.0

    # 1. Biometric / Sleep / Mission Telemetry
    if latest_telemetry is None:
        missing_signals.append("biometric_sleep_telemetry")
        qualities.append(
            SignalQualityEntry(
                signal_name="Biometric & Sleep Telemetry",
                available=False,
                quality_score=0.0,
                note="No recent sleep or heart rate log recorded.",
            )
        )
    else:
        is_syn = bool(latest_telemetry["is_synthetic"])
        qualities.append(
            SignalQualityEntry(
                signal_name="Biometric & Sleep Telemetry",
                available=True,
                quality_score=0.88 if is_syn else 0.96,
                timestamp=latest_telemetry["timestamp"],
                is_synthetic=is_syn,
                note=f"Mission Day {latest_telemetry['mission_day']}"
                + (" (DEMO / SYNTHETIC)" if is_syn else ""),
            )
        )
        sleep_h = float(latest_telemetry["sleep_hours"])
        base_sleep = float(baseline["sleep_hours"])
        sleep_delta_pct = round(((sleep_h - base_sleep) / max(1.0, base_sleep)) * 100.0, 1)
        if sleep_delta_pct <= -22.0:
            overall_status = _max_status(overall_status, "Red")
            risk_points += 24.0
            detected.append(
                DetectedFactor(
                    source_module="telemetry",
                    signal="sleep_duration_deficit",
                    severity="Red",
                    deviation_percent=sleep_delta_pct,
                    summary=f"Sleep dropped to {sleep_h}h vs {base_sleep}h baseline ({sleep_delta_pct:+.1f}%).",
                )
            )
        elif sleep_delta_pct <= -12.0:
            overall_status = _max_status(overall_status, "Yellow")
            risk_points += 14.0
            detected.append(
                DetectedFactor(
                    source_module="telemetry",
                    signal="sleep_duration_compression",
                    severity="Yellow",
                    deviation_percent=sleep_delta_pct,
                    summary=f"Sleep compressed to {sleep_h}h vs {base_sleep}h baseline ({sleep_delta_pct:+.1f}%).",
                )
            )

        rhr = float(latest_telemetry["resting_heart_rate_bpm"])
        base_rhr = float(baseline["resting_heart_rate_bpm"])
        rhr_delta = round(((rhr - base_rhr) / max(1.0, base_rhr)) * 100.0, 1)
        if rhr_delta >= 12.0:
            overall_status = _max_status(overall_status, "Yellow")
            risk_points += 10.0
            detected.append(
                DetectedFactor(
                    source_module="telemetry",
                    signal="resting_hr_elevation",
                    severity="Yellow",
                    deviation_percent=rhr_delta,
                    summary=f"Resting HR elevated ({rhr} bpm vs {base_rhr} bpm baseline, {rhr_delta:+.1f}%).",
                )
            )

    # 2. Vision Monitoring
    if latest_vision is None or latest_vision["status"] != "ok":
        reason = (
            f"Latest capture flagged '{latest_vision['error_code']}'"
            if latest_vision is not None
            else "No vision capture analyzed yet"
        )
        missing_signals.append("vision_monitoring")
        qualities.append(
            SignalQualityEntry(
                signal_name="Vision Monitoring (Face/Eye)",
                available=False,
                quality_score=float(latest_vision["image_quality"]) if latest_vision else 0.0,
                timestamp=latest_vision["timestamp"] if latest_vision else None,
                is_synthetic=bool(latest_vision["is_synthetic"]) if latest_vision else False,
                note=reason,
            )
        )
    else:
        comp = json.loads(latest_vision["baseline_comparison_json"])
        v_qual = float(latest_vision["image_quality"])
        qualities.append(
            SignalQualityEntry(
                signal_name="Vision Monitoring (Face/Eye)",
                available=True,
                quality_score=v_qual,
                timestamp=latest_vision["timestamp"],
                is_synthetic=bool(latest_vision["is_synthetic"]),
                note="Standardized facial landmarks aligned",
            )
        )
        peri_chg = float(comp.get("periorbital_change_percent", 0.0))
        red_chg = float(comp.get("eye_redness_change_percent", 0.0))
        if abs(peri_chg) >= VISION_THRESHOLDS["periorbital_red_pct"]:
            overall_status = _max_status(overall_status, "Red")
            risk_points += 24.0
            detected.append(
                DetectedFactor(
                    source_module="vision",
                    signal="periorbital_change",
                    severity="Red",
                    deviation_percent=peri_chg,
                    summary=f"Notable periorbital index shift ({peri_chg:+.1f}% vs baseline); requires follow-up exam.",
                )
            )
        elif abs(peri_chg) >= VISION_THRESHOLDS["periorbital_yellow_pct"]:
            overall_status = _max_status(overall_status, "Yellow")
            risk_points += 14.0
            detected.append(
                DetectedFactor(
                    source_module="vision",
                    signal="periorbital_change",
                    severity="Yellow",
                    deviation_percent=peri_chg,
                    summary=f"Mild periorbital index shift ({peri_chg:+.1f}% vs baseline).",
                )
            )

        if red_chg >= VISION_THRESHOLDS["redness_red_pct"]:
            overall_status = _max_status(overall_status, "Yellow")
            risk_points += 12.0
            detected.append(
                DetectedFactor(
                    source_module="vision",
                    signal="eye_redness_elevation",
                    severity="Yellow",
                    deviation_percent=red_chg,
                    summary=f"Relative eye-area redness index increased ({red_chg:+.1f}% vs baseline).",
                )
            )
        elif red_chg >= VISION_THRESHOLDS["redness_yellow_pct"]:
            overall_status = _max_status(overall_status, "Yellow")
            risk_points += 8.0
            detected.append(
                DetectedFactor(
                    source_module="vision",
                    signal="eye_redness_elevation",
                    severity="Yellow",
                    deviation_percent=red_chg,
                    summary=f"Slight eye-area redness index shift ({red_chg:+.1f}% vs baseline).",
                )
            )

    # 3. Cognitive Audio Monitoring
    if latest_audio is None or latest_audio["status"] != "ok":
        reason = (
            f"Latest audio flagged '{latest_audio['error_code']}'"
            if latest_audio is not None
            else "No voice check-in analyzed yet"
        )
        missing_signals.append("cognitive_audio")
        qualities.append(
            SignalQualityEntry(
                signal_name="Cognitive Speech & Acoustics",
                available=False,
                quality_score=float(latest_audio["data_quality"]) if latest_audio else 0.0,
                timestamp=latest_audio["timestamp"] if latest_audio else None,
                is_synthetic=bool(latest_audio["is_synthetic"]) if latest_audio else False,
                note=reason,
            )
        )
    else:
        acomp = json.loads(latest_audio["baseline_comparison_json"])
        qualities.append(
            SignalQualityEntry(
                signal_name="Cognitive Speech & Acoustics",
                available=True,
                quality_score=float(latest_audio["data_quality"]),
                timestamp=latest_audio["timestamp"],
                is_synthetic=bool(latest_audio["is_synthetic"]),
                note=f"Engine: {latest_audio['transcription_engine']}",
            )
        )
        pause_chg = float(acomp.get("pause_duration_change_percent", 0.0))
        rate_chg = float(acomp.get("speech_rate_change_percent", 0.0))

        if pause_chg >= AUDIO_THRESHOLDS["pause_red_pct"]:
            overall_status = _max_status(overall_status, "Yellow")
            risk_points += 14.0
            detected.append(
                DetectedFactor(
                    source_module="cognitive_audio",
                    signal="pause_duration_increase",
                    severity="Yellow",
                    deviation_percent=pause_chg,
                    summary=f"Mean inter-speech pause duration rose {pause_chg:+.1f}% vs baseline.",
                )
            )
        elif pause_chg >= AUDIO_THRESHOLDS["pause_yellow_pct"]:
            overall_status = _max_status(overall_status, "Yellow")
            risk_points += 9.0
            detected.append(
                DetectedFactor(
                    source_module="cognitive_audio",
                    signal="pause_duration_increase",
                    severity="Yellow",
                    deviation_percent=pause_chg,
                    summary=f"Moderate increase in speech pause duration ({pause_chg:+.1f}% vs baseline).",
                )
            )

        if abs(rate_chg) >= AUDIO_THRESHOLDS["speech_rate_red_pct"]:
            overall_status = _max_status(overall_status, "Yellow")
            risk_points += 10.0
            detected.append(
                DetectedFactor(
                    source_module="cognitive_audio",
                    signal="speech_rate_shift",
                    severity="Yellow",
                    deviation_percent=rate_chg,
                    summary=f"Speech cadence shifted {rate_chg:+.1f}% relative to baseline.",
                )
            )

    # 4. Controlled Cognitive Tests
    if not latest_tests:
        missing_signals.append("cognitive_tests")
        qualities.append(
            SignalQualityEntry(
                signal_name="Controlled Cognitive Tasks",
                available=False,
                quality_score=0.0,
                note="No Reaction, Memory, or Attention task recorded yet.",
            )
        )
    else:
        any_syn = any(bool(r["is_synthetic"]) for r in latest_tests.values())
        qualities.append(
            SignalQualityEntry(
                signal_name="Controlled Cognitive Tasks",
                available=True,
                quality_score=0.92 if not any_syn else 0.85,
                timestamp=max(r["timestamp"] for r in latest_tests.values()),
                is_synthetic=any_syn,
                note=f"{len(latest_tests)}/3 task domains recorded",
            )
        )
        for ttype, row in latest_tests.items():
            chg = float(row["change_percent"])
            if ttype == "reaction_time" and chg >= 18.0:
                overall_status = _max_status(overall_status, "Yellow")
                risk_points += 13.0
                detected.append(
                    DetectedFactor(
                        source_module="cognitive_test",
                        signal="reaction_time_slowing",
                        severity="Yellow",
                        deviation_percent=chg,
                        summary=f"Reaction latency slowed to {row['score']} ms ({chg:+.1f}% vs {row['baseline_value']} ms baseline).",
                    )
                )
            elif ttype in ("memory", "attention") and chg <= -12.0:
                overall_status = _max_status(overall_status, "Yellow")
                risk_points += 13.0
                detected.append(
                    DetectedFactor(
                        source_module="cognitive_test",
                        signal=f"{ttype}_score_drop",
                        severity="Yellow",
                        deviation_percent=chg,
                        summary=f"{ttype.capitalize()} task score at {row['score']}% ({chg:+.1f}% vs {row['baseline_value']}% baseline).",
                    )
                )

    # Multi-signal escalation rule: 3+ distinct Yellow/Red signals elevate overall attention to Red
    yellow_or_red_modules = {d.source_module for d in detected}
    if len(detected) >= 3 and len(yellow_or_red_modules) >= 2:
        overall_status = "Red"
        risk_points = max(risk_points, 72.0)

    available_count = sum(1 for q in qualities if q.available)
    data_completeness = round(available_count / max(1, len(qualities)), 2)
    risk_score = round(min(98.0, risk_points), 1)

    if overall_status == "Green":
        explanation = (
            "Available biometric, visual, acoustic, and cognitive indicators remain within individual "
            "nominal baseline tolerances."
        )
        next_steps = [
            "Continue scheduled daily autonomous check-ins.",
            "Maintain current sleep, hydration, and resistive exercise cadence.",
        ]
        if missing_signals:
            next_steps.append(
                f"Capture missing signals ({', '.join(missing_signals)}) to raise confidence above {int(data_completeness * 100)}%."
            )
    elif overall_status == "Yellow":
        explanation = (
            f"Detected {len(detected)} mild-to-moderate baseline deviation(s) across "
            f"{', '.join(sorted(yellow_or_red_modules))}. Repeat standardized checks before escalating."
        )
        next_steps = [
            "Repeat Vision or Cognitive measurements under standardized cabin lighting and quiet mic conditions.",
            "Prioritize 7.5+ hours recovery sleep and verify hydration target (>2.5 L/day).",
            "Re-run Health Intelligence after repeat capture to verify trend direction.",
        ]
    else:
        explanation = (
            f"Multi-signal convergence or high-magnitude shift detected ({len(detected)} factors across "
            f"{', '.join(sorted(yellow_or_red_modules))}). Human verification recommended."
        )
        next_steps = [
            "Flag report for Crew Medical Officer / Flight Surgeon asynchronous review.",
            "Schedule immediate workload offloading and rest window verification.",
            "Perform standardized repeat Vision + Attention verification within 12 hours.",
        ]

    if self_report_note:
        explanation += f" Crew self-report note recorded: '{self_report_note.strip()}'."

    requires_human_review = overall_status in ("Yellow", "Red")

    response = HealthIntelligenceResponse(
        astronaut_id=astronaut_id,
        timestamp=now_iso,
        overall_status=overall_status,
        risk_score=risk_score,
        data_completeness=data_completeness,
        detected_signals=detected,
        missing_signals=missing_signals,
        signal_qualities=qualities,
        explanation=explanation,
        recommended_next_steps=next_steps,
        requires_human_review=requires_human_review,
    )

    with db_session(db_path) as conn:
        cur = conn.execute(
            """
            INSERT INTO intelligence_reports (
                astronaut_id, timestamp, overall_status, risk_score, data_completeness,
                detected_signals_json, missing_signals_json, signal_qualities_json,
                explanation, recommended_next_steps_json, requires_human_review
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                response.astronaut_id,
                response.timestamp,
                response.overall_status,
                response.risk_score,
                response.data_completeness,
                json.dumps([d.model_dump() for d in response.detected_signals]),
                json.dumps(response.missing_signals),
                json.dumps([q.model_dump() for q in response.signal_qualities]),
                response.explanation,
                json.dumps(response.recommended_next_steps),
                1 if response.requires_human_review else 0,
            ),
        )
        response.id = int(cur.lastrowid)
        conn.execute(
            """
            INSERT INTO offline_sync_queue (astronaut_id, module, payload_summary, status, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                response.astronaut_id,
                "health_intelligence",
                f"status={response.overall_status}, risk={response.risk_score}, completeness={response.data_completeness}",
                "queued_offline",
                response.timestamp,
            ),
        )

    return response


def get_latest_intelligence(astronaut_id: str, db_path: Path = DB_PATH) -> Optional[HealthIntelligenceResponse]:
    with db_session(db_path) as conn:
        row = conn.execute(
            """
            SELECT * FROM intelligence_reports
            WHERE astronaut_id = ?
            ORDER BY id DESC LIMIT 1
            """,
            (astronaut_id,),
        ).fetchone()
        if row is None:
            return None
        return HealthIntelligenceResponse(
            id=int(row["id"]),
            astronaut_id=row["astronaut_id"],
            timestamp=row["timestamp"],
            overall_status=row["overall_status"],
            risk_score=float(row["risk_score"]),
            data_completeness=float(row["data_completeness"]),
            detected_signals=[DetectedFactor(**d) for d in json.loads(row["detected_signals_json"])],
            missing_signals=json.loads(row["missing_signals_json"]),
            signal_qualities=[SignalQualityEntry(**q) for q in json.loads(row["signal_qualities_json"])],
            explanation=row["explanation"],
            recommended_next_steps=json.loads(row["recommended_next_steps_json"]),
            requires_human_review=bool(row["requires_human_review"]),
        )
