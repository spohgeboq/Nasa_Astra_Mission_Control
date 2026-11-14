"""Pydantic schemas for Cognitive Monitoring (Audio + Interactive Tests)."""

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class AudioMeasurements(BaseModel):
    duration_sec: float = 0.0
    speech_rate_wpm: Optional[float] = None
    pause_duration_sec: Optional[float] = None
    pause_ratio: Optional[float] = None
    voice_energy_rms: Optional[float] = None
    voice_variability: Optional[float] = None
    word_repetition_ratio: Optional[float] = None
    snr_db_estimate: Optional[float] = None


class CognitiveAudioResponse(BaseModel):
    id: Optional[int] = None
    astronaut_id: str
    module: str = "cognitive_audio"
    timestamp: str
    status: str = Field(description="ok | noisy_audio | audio_too_short")
    error_code: Optional[str] = None
    error_detail: Optional[str] = None
    data_quality: float = Field(ge=0.0, le=1.0)
    transcript: str = ""
    transcription_engine: str = "faster-whisper"
    measurements: AudioMeasurements
    baseline_comparison: Dict[str, float] = {}
    anomalies: List[str] = []
    is_synthetic: bool = False
    scientific_disclaimer: str = (
        "Acoustic and speech markers reflect relative fatigue/load shifts against baseline only. "
        "Voice analysis does NOT diagnose depression, anxiety, or psychiatric disorders."
    )


class CognitiveTestSubmit(BaseModel):
    astronaut_id: str
    test_type: Literal["reaction_time", "memory", "attention"]
    score: float = Field(..., ge=0.0, le=5000.0)
    unit: Literal["ms", "percent"]
    trials_count: int = Field(default=5, ge=1, le=100)
    accuracy_percent: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    metadata: Dict[str, float] = {}
    is_synthetic: bool = False


class CognitiveTestResponse(BaseModel):
    id: int
    astronaut_id: str
    module: str = "cognitive_test"
    test_type: str
    timestamp: str
    data_quality: float = 1.0
    score: float
    unit: str
    accuracy_percent: Optional[float] = None
    baseline_value: float
    change_percent: float
    anomaly_detected: bool
    is_synthetic: bool = False
