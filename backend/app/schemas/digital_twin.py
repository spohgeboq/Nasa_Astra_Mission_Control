"""Pydantic schemas for Digital Twin Forecast & What-If Simulator."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ForecastPoint(BaseModel):
    day_offset: int
    mission_day: int
    label: str
    is_forecast: bool
    is_synthetic: bool
    cognitive_readiness: float
    fatigue_index: float
    recovery_score: float
    uncertainty_band: float = 0.0


class DigitalTwinForecastResponse(BaseModel):
    astronaut_id: str
    module: str = "digital_twin"
    timestamp: str
    current_mission_day: int
    baseline_readiness: float
    history_and_forecast: List[ForecastPoint]
    model_assumptions: List[str]
    disclaimer: str = (
        "Scenario-based mathematical projection for MVP exploration only. "
        "Not a guaranteed physiological prediction."
    )


class WhatIfInput(BaseModel):
    astronaut_id: str
    sleep_hours: float = Field(default=7.5, ge=3.5, le=11.0)
    exercise_minutes: float = Field(default=75.0, ge=0.0, le=180.0)
    nutrition_score: float = Field(default=88.0, ge=30.0, le=100.0)
    hydration_liters: float = Field(default=2.6, ge=0.8, le=5.0)
    workload_index: float = Field(default=60.0, ge=15.0, le=100.0)


class WhatIfScenarioResponse(BaseModel):
    astronaut_id: str
    module: str = "digital_twin_what_if"
    timestamp: str
    inputs: WhatIfInput
    baseline_scenario: List[ForecastPoint]
    adjusted_scenario: List[ForecastPoint]
    day_14_delta: Dict[str, float]
    explanation: str
    formulas_used: List[str]
    disclaimer: str = (
        "Scenario simulation estimate using transparent linear-coupled MVP rules—not clinical validation."
    )
