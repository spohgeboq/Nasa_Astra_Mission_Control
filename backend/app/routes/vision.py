"""Routes for Vision Monitoring (Image Upload, Live Webcam Frame, Demo Samples)."""

import json
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from ..config import DEMO_DATA_DIR
from ..database import db_session
from ..schemas.vision import VisionAnalysisResponse, VisionMeasurements
from ..services.vision_service import analyze_vision_image

router = APIRouter(prefix="/api/vision", tags=["vision"])


@router.post("/analyze", response_model=VisionAnalysisResponse)
async def analyze_vision(
    astronaut_id: str = Form("AST-001"),
    is_synthetic: bool = Form(False),
    file: UploadFile = File(...),
) -> VisionAnalysisResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")
    try:
        return analyze_vision_image(
            astronaut_id=astronaut_id,
            image_bytes=content,
            filename=file.filename or "capture.png",
            is_synthetic=is_synthetic,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/analyze-demo", response_model=VisionAnalysisResponse)
def analyze_demo_vision(
    astronaut_id: str = Query("AST-001"),
    sample: str = Query("followup", pattern="^(baseline|followup|poor)$"),
) -> VisionAnalysisResponse:
    sample_map = {
        "baseline": DEMO_DATA_DIR / "ast001_baseline_face.jpg",
        "followup": DEMO_DATA_DIR / "ast001_followup_face.jpg",
        "poor": DEMO_DATA_DIR / "ast001_poor_blurry.jpg",
    }
    path = sample_map[sample]
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Demo sample '{sample}' not found.")
    try:
        return analyze_vision_image(
            astronaut_id=astronaut_id,
            image_bytes=path.read_bytes(),
            filename=path.name,
            is_synthetic=True,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{astronaut_id}/history", response_model=List[VisionAnalysisResponse])
def get_vision_history(astronaut_id: str) -> List[VisionAnalysisResponse]:
    with db_session() as conn:
        rows = conn.execute(
            """
            SELECT * FROM vision_analyses
            WHERE astronaut_id = ?
            ORDER BY id DESC LIMIT 20
            """,
            (astronaut_id,),
        ).fetchall()

    return [
        VisionAnalysisResponse(
            id=int(r["id"]),
            astronaut_id=r["astronaut_id"],
            timestamp=r["timestamp"],
            status=r["status"],
            error_code=r["error_code"],
            error_detail=r["error_detail"],
            image_quality=float(r["image_quality"]),
            measurements=VisionMeasurements(**json.loads(r["measurements_json"])),
            baseline_comparison=json.loads(r["baseline_comparison_json"]),
            anomalies=json.loads(r["anomalies_json"]),
            requires_follow_up=bool(r["requires_follow_up"]),
            source_image_url=r["source_image_url"],
            overlay_image_url=r["overlay_image_url"],
            is_synthetic=bool(r["is_synthetic"]),
        )
        for r in rows
    ]
