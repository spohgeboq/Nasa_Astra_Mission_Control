"""Transparent Digital Twin 14-day projection and What-If simulation service."""

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

from ..config import DB_PATH
from ..database import db_session
from ..schemas.digital_twin import (
    DigitalTwinForecastResponse,
    ForecastPoint,
    WhatIfInput,
    WhatIfScenarioResponse,
)


def _compute_readiness_from_telemetry(
    sleep_h: float,
    sleep_q: float,
    activity_min: float,
    hydration_l: float,
    nutrition: float,
    workload: float,
    base_sleep: float,
    base_activity: float,
) -> Tuple[float, float, float]:
    """Deterministic scenario equations returning (cognitive_readiness, fatigue_index, recovery_score)."""
    sleep_ratio = min(1.15, sleep_h / max(4.0, base_sleep))
    activity_balance = 1.0 - min(0.35, abs(activity_min - base_activity) / 140.0)
    hydration_term = min(1.05, hydration_l / 2.5)
    nutrition_term = nutrition / 100.0
    workload_strain = max(0.0, (workload - 55.0) * 0.42)

    recovery = (
        0.46 * (sleep_ratio * 100.0)
        + 0.22 * sleep_q
        + 0.16 * (hydration_term * 100.0)
        + 0.16 * (nutrition_term * 100.0)
    )
    recovery = float(np.clip(recovery, 25.0, 99.0))

    readiness = (
        0.58 * recovery
        + 0.25 * (activity_balance * 100.0)
        + 0.17 * 88.0
        - workload_strain * 0.65
    )
    readiness = float(np.clip(readiness, 25.0, 99.0))
    fatigue = float(np.clip(100.0 - readiness + workload_strain * 0.35, 5.0, 95.0))
    return round(readiness, 1), round(fatigue, 1), round(recovery, 1)


def _project_14_days(
    start_day: int,
    start_readiness: float,
    start_fatigue: float,
    start_recovery: float,
    target_readiness: float,
    target_fatigue: float,
    target_recovery: float,
    slope_bias: float,
) -> List[ForecastPoint]:
    points: List[ForecastPoint] = []
    cur_r, cur_f, cur_rec = start_readiness, start_fatigue, start_recovery
    alpha = 0.22  # exponential convergence rate toward scenario steady state

    for offset in range(1, 15):
        cur_r = float(np.clip(cur_r + alpha * (target_readiness - cur_r) + slope_bias * 0.12, 20.0, 99.0))
        cur_f = float(np.clip(cur_f + alpha * (target_fatigue - cur_f) - slope_bias * 0.10, 5.0, 95.0))
        cur_rec = float(np.clip(cur_rec + alpha * (target_recovery - cur_rec) + slope_bias * 0.08, 20.0, 99.0))
        uncertainty = round(1.8 + offset * 0.55, 1)
        points.append(
            ForecastPoint(
                day_offset=offset,
                mission_day=start_day + offset,
                label=f"MD {start_day + offset}",
                is_forecast=True,
                is_synthetic=True,
                cognitive_readiness=round(cur_r, 1),
                fatigue_index=round(cur_f, 1),
                recovery_score=round(cur_rec, 1),
                uncertainty_band=uncertainty,
            )
        )
    return points


def get_digital_twin_forecast(
    astronaut_id: str,
    db_path: Path = DB_PATH,
) -> DigitalTwinForecastResponse:
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with db_session(db_path) as conn:
        astronaut = conn.execute(
            "SELECT mission_day FROM astronauts WHERE astronaut_id = ?", (astronaut_id,)
        ).fetchone()
        if astronaut is None:
            raise LookupError(f"Astronaut '{astronaut_id}' not found.")
        baseline = conn.execute(
            "SELECT * FROM baselines WHERE astronaut_id = ?", (astronaut_id,)
        ).fetchone()
        rows = conn.execute(
            """
            SELECT * FROM telemetry_records
            WHERE astronaut_id = ?
            ORDER BY mission_day ASC, id ASC
            """,
            (astronaut_id,),
        ).fetchall()

    base_sleep = float(baseline["sleep_hours"])
    base_act = float(baseline["activity_minutes"])
    base_readiness, _, _ = _compute_readiness_from_telemetry(
        base_sleep,
        float(baseline["sleep_quality_score"]),
        base_act,
        float(baseline["hydration_liters"]),
        float(baseline["nutrition_score"]),
        58.0,
        base_sleep,
        base_act,
    )

    history_points: List[ForecastPoint] = []
    recent_rows = rows[-14:] if len(rows) > 14 else rows
    current_day = int(astronaut["mission_day"])

    if recent_rows:
        for r in recent_rows:
            rd, ft, rc = _compute_readiness_from_telemetry(
                float(r["sleep_hours"]),
                float(r["sleep_quality_score"]),
                float(r["activity_minutes"]),
                float(r["hydration_liters"]),
                float(r["nutrition_score"]),
                float(r["workload_index"]),
                base_sleep,
                base_act,
            )
            md = int(r["mission_day"])
            history_points.append(
                ForecastPoint(
                    day_offset=md - current_day,
                    mission_day=md,
                    label=f"MD {md}",
                    is_forecast=False,
                    is_synthetic=bool(r["is_synthetic"]),
                    cognitive_readiness=rd,
                    fatigue_index=ft,
                    recovery_score=rc,
                    uncertainty_band=0.0,
                )
            )
        last = history_points[-1]
        start_r, start_f, start_rec = last.cognitive_readiness, last.fatigue_index, last.recovery_score
        current_day = max(current_day, last.mission_day)
    else:
        start_r, start_f, start_rec = base_readiness, 18.0, 86.0
        history_points.append(
            ForecastPoint(
                day_offset=0,
                mission_day=current_day,
                label=f"MD {current_day}",
                is_forecast=False,
                is_synthetic=False,
                cognitive_readiness=start_r,
                fatigue_index=start_f,
                recovery_score=start_rec,
            )
        )

    # Recent linear slope across last 5 points
    tail = [p.cognitive_readiness for p in history_points[-5:]]
    slope = float(np.polyfit(range(len(tail)), tail, 1)[0]) if len(tail) >= 3 else 0.0

    # Status-quo continuation target (if recent conditions persist)
    if recent_rows:
        last_row = recent_rows[-1]
        tgt_r, tgt_f, tgt_rec = _compute_readiness_from_telemetry(
            float(last_row["sleep_hours"]),
            float(last_row["sleep_quality_score"]),
            float(last_row["activity_minutes"]),
            float(last_row["hydration_liters"]),
            float(last_row["nutrition_score"]),
            float(last_row["workload_index"]),
            base_sleep,
            base_act,
        )
    else:
        tgt_r, tgt_f, tgt_rec = base_readiness, 18.0, 86.0

    forecast = _project_14_days(
        current_day, start_r, start_f, start_rec, tgt_r, tgt_f, tgt_rec, slope_bias=slope
    )

    return DigitalTwinForecastResponse(
        astronaut_id=astronaut_id,
        timestamp=now_iso,
        current_mission_day=current_day,
        baseline_readiness=base_readiness,
        history_and_forecast=history_points + forecast,
        model_assumptions=[
            "Readiness is computed as a bounded weighted composite of sleep ratio vs personal baseline (46% of recovery), sleep quality (22%), hydration/nutrition (32%), exercise balance, and workload strain.",
            "14-day projection uses exponential convergence (alpha = 0.22/day) from latest measured state plus 5-day local trend slope.",
            "Uncertainty band widens linearly (+0.55 index pts/day) to communicate increasing forecast ambiguity.",
        ],
    )


def simulate_what_if(
    payload: WhatIfInput,
    db_path: Path = DB_PATH,
) -> WhatIfScenarioResponse:
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    base_forecast = get_digital_twin_forecast(payload.astronaut_id, db_path)

    with db_session(db_path) as conn:
        baseline = conn.execute(
            "SELECT * FROM baselines WHERE astronaut_id = ?", (payload.astronaut_id,)
        ).fetchone()

    base_sleep = float(baseline["sleep_hours"])
    base_act = float(baseline["activity_minutes"])

    hist_only = [p for p in base_forecast.history_and_forecast if not p.is_forecast]
    last_hist = hist_only[-1]
    baseline_future = [p for p in base_forecast.history_and_forecast if p.is_forecast]

    adj_sleep_q = float(np.clip(72.0 + (payload.sleep_hours - 6.0) * 8.5, 52.0, 96.0))
    tgt_r, tgt_f, tgt_rec = _compute_readiness_from_telemetry(
        payload.sleep_hours,
        adj_sleep_q,
        payload.exercise_minutes,
        payload.hydration_liters,
        payload.nutrition_score,
        payload.workload_index,
        base_sleep,
        base_act,
    )

    adjusted_future = _project_14_days(
        base_forecast.current_mission_day,
        last_hist.cognitive_readiness,
        last_hist.fatigue_index,
        last_hist.recovery_score,
        tgt_r,
        tgt_f,
        tgt_rec,
        slope_bias=0.0,
    )

    d14_base = baseline_future[-1]
    d14_adj = adjusted_future[-1]

    delta_r = round(d14_adj.cognitive_readiness - d14_base.cognitive_readiness, 1)
    delta_f = round(d14_adj.fatigue_index - d14_base.fatigue_index, 1)
    delta_rec = round(d14_adj.recovery_score - d14_base.recovery_score, 1)

    explanation = (
        f"Adjusting target regimen (Sleep {payload.sleep_hours}h, Exercise {payload.exercise_minutes}m, "
        f"Nutrition {payload.nutrition_score}%, Hydration {payload.hydration_liters}L, Workload {payload.workload_index}) "
        f"shifts Day +14 readiness by {delta_r:+.1f} pts and fatigue by {delta_f:+.1f} pts compared to current trajectory."
    )

    return WhatIfScenarioResponse(
        astronaut_id=payload.astronaut_id,
        timestamp=now_iso,
        inputs=payload,
        baseline_scenario=baseline_future,
        adjusted_scenario=adjusted_future,
        day_14_delta={
            "cognitive_readiness_delta": delta_r,
            "fatigue_index_delta": delta_f,
            "recovery_score_delta": delta_rec,
        },
        explanation=explanation,
        formulas_used=[
            "Recovery = 0.46*(Sleep/Baseline*100) + 0.22*EstSleepQuality + 0.16*(Hydration/2.5*100) + 0.16*Nutrition",
            "Readiness = 0.58*Recovery + 0.25*ExerciseBalance + 14.96 - 0.65*max(0, (Workload-55)*0.42)",
            "State(t+1) = State(t) + 0.22 * (TargetSteadyState - State(t))",
        ],
    )
