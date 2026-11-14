"""Routes for Digital Twin 14-day Forecast and What-If Simulation."""

from fastapi import APIRouter, HTTPException

from ..schemas.digital_twin import (
    DigitalTwinForecastResponse,
    WhatIfInput,
    WhatIfScenarioResponse,
)
from ..services.twin_service import get_digital_twin_forecast, simulate_what_if

router = APIRouter(prefix="/api/digital-twin", tags=["digital-twin"])


@router.get("/{astronaut_id}/forecast", response_model=DigitalTwinForecastResponse)
def get_forecast(astronaut_id: str) -> DigitalTwinForecastResponse:
    try:
        return get_digital_twin_forecast(astronaut_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/simulate", response_model=WhatIfScenarioResponse)
def run_what_if(payload: WhatIfInput) -> WhatIfScenarioResponse:
    try:
        return simulate_what_if(payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
