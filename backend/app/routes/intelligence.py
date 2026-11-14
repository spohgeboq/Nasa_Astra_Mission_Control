"""Routes for Health Intelligence Multi-Signal Fusion."""

from fastapi import APIRouter, HTTPException

from ..schemas.intelligence import HealthIntelligenceResponse, HealthIntelligenceRunRequest
from ..services.intelligence_service import get_latest_intelligence, run_health_intelligence

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])


@router.post("/run", response_model=HealthIntelligenceResponse)
def run_intelligence_analysis(payload: HealthIntelligenceRunRequest) -> HealthIntelligenceResponse:
    try:
        return run_health_intelligence(
            astronaut_id=payload.astronaut_id,
            self_report_note=payload.include_self_report_note,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{astronaut_id}/latest", response_model=HealthIntelligenceResponse)
def get_latest_report(astronaut_id: str) -> HealthIntelligenceResponse:
    latest = get_latest_intelligence(astronaut_id)
    if latest is None:
        try:
            return run_health_intelligence(astronaut_id=astronaut_id)
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    return latest
