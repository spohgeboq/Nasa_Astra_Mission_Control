"""Pydantic schemas for Health Intelligence Multi-Signal Fusion."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from .common import StatusLevel


class SignalQualityEntry(BaseModel):
    signal_name: str
    available: bool
    quality_score: float = Field(ge=0.0, le=1.0)
    timestamp: Optional[str] = None
    is_synthetic: bool = False
    note: str


class DetectedFactor(BaseModel):
    source_module: str
    signal: str
    severity: StatusLevel
    deviation_percent: float
    summary: str


class HealthIntelligenceRunRequest(BaseModel):
    astronaut_id: str
    include_self_report_note: Optional[str] = None


class HealthIntelligenceResponse(BaseModel):
    id: Optional[int] = None
    astronaut_id: str
    module: str = "health_intelligence"
    timestamp: str
    overall_status: StatusLevel
    risk_score: float = Field(ge=0.0, le=100.0)
    data_completeness: float = Field(ge=0.0, le=1.0)
    detected_signals: List[DetectedFactor] = []
    missing_signals: List[str] = []
    signal_qualities: List[SignalQualityEntry] = []
    explanation: str
    recommended_next_steps: List[str] = []
    requires_human_review: bool = False
    thresholds_disclaimer: str = (
        "All Yellow/Red thresholds in ASTRA are demonstration MVP rules—not validated NASA flight surgeon criteria."
    )
