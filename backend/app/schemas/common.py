"""Shared schema primitives and scientific disclaimers."""

from typing import Literal, Optional
from pydantic import BaseModel, Field


StatusLevel = Literal["Green", "Yellow", "Red"]


class DataProvenance(BaseModel):
    is_synthetic: bool = Field(
        default=False,
        description="Explicitly marks DEMO / SYNTHETIC records vs live captured/uploaded measurements.",
    )
    source_label: str = Field(default="local_capture")


class MetricComparison(BaseModel):
    metric: str
    current_value: float
    baseline_value: float
    unit: str
    change_percent: float
    direction: Literal["higher", "lower", "neutral"]
    note: Optional[str] = None
