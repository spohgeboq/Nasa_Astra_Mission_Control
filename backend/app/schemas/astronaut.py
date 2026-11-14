"""Pydantic schemas for Astronaut Profile, Baseline, and Telemetry History."""

from typing import List, Optional
from pydantic import BaseModel, Field


class BaselineProfile(BaseModel):
    resting_heart_rate_bpm: float = Field(default=62.0, ge=35, le=140)
    sleep_hours: float = Field(default=7.5, ge=2.0, le=14.0)
    sleep_quality_score: float = Field(default=86.0, ge=0, le=100)
    activity_minutes: float = Field(default=75.0, ge=0, le=360)
    hydration_liters: float = Field(default=2.6, ge=0.5, le=8.0)
    nutrition_score: float = Field(default=88.0, ge=0, le=100)
    reaction_time_ms: float = Field(default=265.0, ge=100, le=1500)
    memory_score: float = Field(default=90.0, ge=0, le=100)
    attention_score: float = Field(default=92.0, ge=0, le=100)
    periorbital_index: float = Field(default=100.0, ge=10, le=300)
    eye_redness_index: float = Field(default=12.0, ge=0, le=100)
    speech_rate_wpm: float = Field(default=138.0, ge=40, le=300)
    pause_duration_sec: float = Field(default=0.42, ge=0.05, le=5.0)
    voice_energy_rms: float = Field(default=0.065, ge=0.001, le=1.0)
    voice_variability: float = Field(default=22.0, ge=1.0, le=200.0)


class AstronautCreate(BaseModel):
    astronaut_id: Optional[str] = Field(default=None, description="e.g. AST-002")
    name: str = Field(..., min_length=2, max_length=120)
    age: int = Field(..., ge=20, le=80)
    height_cm: float = Field(..., ge=130, le=220)
    weight_kg: float = Field(..., ge=40, le=150)
    mission_name: str = Field(..., min_length=2, max_length=160)
    mission_type: str = Field(default="Long-Duration Orbital / Lunar Transit")
    mission_day: int = Field(default=1, ge=1, le=1200)
    blood_type: str = Field(default="O+")
    medical_history: str = Field(default="No chronic conditions reported.")
    allergies: str = Field(default="None known")
    medications: str = Field(default="Standard orbital vitamin D supplementation")
    medical_notes: str = Field(default="Cleared for autonomous flight monitoring.")
    baseline: Optional[BaselineProfile] = None


class AstronautUpdate(BaseModel):
    name: Optional[str] = None
    mission_name: Optional[str] = None
    mission_type: Optional[str] = None
    mission_day: Optional[int] = Field(default=None, ge=1, le=1200)
    medical_history: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    medical_notes: Optional[str] = None


class TelemetryPointCreate(BaseModel):
    mission_day: int = Field(..., ge=1, le=1200)
    timestamp: Optional[str] = None
    resting_heart_rate_bpm: float = Field(..., ge=35, le=160)
    sleep_hours: float = Field(..., ge=0, le=16)
    sleep_quality_score: float = Field(..., ge=0, le=100)
    activity_minutes: float = Field(..., ge=0, le=400)
    hydration_liters: float = Field(default=2.4, ge=0, le=8)
    nutrition_score: float = Field(default=85.0, ge=0, le=100)
    workload_index: float = Field(default=60.0, ge=0, le=100)
    radiation_msv_day: float = Field(default=0.65, ge=0, le=10)
    self_report_mood: Optional[str] = None
    self_report_fatigue: Optional[int] = Field(default=None, ge=1, le=10)
    is_synthetic: bool = False


class TelemetryPoint(TelemetryPointCreate):
    id: int
    astronaut_id: str
    timestamp: str


class AstronautProfileResponse(BaseModel):
    astronaut_id: str
    name: str
    age: int
    height_cm: float
    weight_kg: float
    mission_name: str
    mission_type: str
    mission_day: int
    blood_type: str
    medical_history: str
    allergies: str
    medications: str
    medical_notes: str
    created_at: str
    updated_at: str
    is_synthetic_seed: bool = False
    baseline: BaselineProfile
    telemetry_history: List[TelemetryPoint] = []
