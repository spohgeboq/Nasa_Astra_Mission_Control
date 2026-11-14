"""Pydantic schemas for Vision Monitoring module."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class VisionMeasurements(BaseModel):
    periorbital_index: Optional[float] = None
    eye_redness_index: Optional[float] = None
    head_yaw_deg: Optional[float] = None
    head_roll_deg: Optional[float] = None
    sharpness_score: Optional[float] = None
    brightness_score: Optional[float] = None
    face_confidence: Optional[float] = None


class VisionAnalysisResponse(BaseModel):
    id: Optional[int] = None
    astronaut_id: str
    module: str = "vision"
    timestamp: str
    status: str = Field(description="ok | no_face_detected | low_image_quality")
    error_code: Optional[str] = None
    error_detail: Optional[str] = None
    image_quality: float = Field(ge=0.0, le=1.0)
    measurements: VisionMeasurements
    baseline_comparison: Dict[str, float] = {}
    anomalies: List[str] = []
    requires_follow_up: bool = False
    source_image_url: Optional[str] = None
    overlay_image_url: Optional[str] = None
    is_synthetic: bool = False
    scientific_disclaimer: str = (
        "MVP screening signal only. A standard RGB camera does NOT diagnose SANS, "
        "measure intracranial pressure (ICP), or replace clinical OCT/ophthalmic exams."
    )
