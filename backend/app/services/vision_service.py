"""Computer Vision analysis service using OpenCV and MediaPipe FaceLandmarker."""

from datetime import datetime, timezone
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import uuid

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
import numpy as np

from ..config import DB_PATH, MODELS_DIR, OVERLAYS_DIR, UPLOADS_DIR, VISION_THRESHOLDS
from ..database import db_session
from ..schemas.vision import VisionAnalysisResponse, VisionMeasurements


# MediaPipe 468-landmark eye & periorbital indices
LEFT_EYE_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
RIGHT_EYE_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
LEFT_PERIORBITAL = [226, 247, 30, 29, 27, 28, 56, 190, 243, 112, 26, 22, 23, 24, 110, 25]
RIGHT_PERIORBITAL = [446, 467, 260, 259, 257, 258, 286, 414, 463, 341, 256, 252, 253, 254, 339, 255]


_LANDMARKER: Optional[mp_vision.FaceLandmarker] = None


def _get_landmarker() -> mp_vision.FaceLandmarker:
    global _LANDMARKER
    if _LANDMARKER is None:
        model_path = MODELS_DIR / "face_landmarker.task"
        if not model_path.exists():
            raise FileNotFoundError(
                f"MediaPipe FaceLandmarker model missing at {model_path}."
            )
        base_options = mp_python.BaseOptions(model_asset_path=str(model_path))
        options = mp_vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=True,
            num_faces=1,
            min_face_detection_confidence=0.45,
            min_face_presence_confidence=0.45,
        )
        _LANDMARKER = mp_vision.FaceLandmarker.create_from_options(options)
    return _LANDMARKER


def _polygon_points(landmarks: Any, indices: List[int], width: int, height: int) -> np.ndarray:
    pts = [
        [int(round(landmarks[idx].x * width)), int(round(landmarks[idx].y * height))]
        for idx in indices
    ]
    return np.array(pts, dtype=np.int32)


def _compute_eye_redness(rgb_img: np.ndarray, left_poly: np.ndarray, right_poly: np.ndarray) -> float:
    mask = np.zeros(rgb_img.shape[:2], dtype=np.uint8)
    cv2.fillPoly(mask, [left_poly], 255)
    cv2.fillPoly(mask, [right_poly], 255)
    pixels = rgb_img[mask == 255]
    if len(pixels) == 0:
        return 12.0
    r = pixels[:, 0].astype(np.float32)
    g = pixels[:, 1].astype(np.float32)
    b = pixels[:, 2].astype(np.float32)
    # Normalized excess red relative to green/blue channel energy
    excess_red = np.maximum(0.0, r - 0.5 * (g + b)) / 255.0
    raw_score = float(np.mean(excess_red) * 180.0)
    return round(float(np.clip(raw_score, 2.0, 95.0)), 2)


def _compute_periorbital_index(
    rgb_img: np.ndarray,
    landmarks: Any,
    left_peri: np.ndarray,
    right_peri: np.ndarray,
    width: int,
    height: int,
) -> float:
    # Inter-ocular distance between outer eye corners (33 and 263)
    lx, ly = landmarks[33].x * width, landmarks[33].y * height
    rx, ry = landmarks[263].x * width, landmarks[263].y * height
    iod = max(1.0, math.hypot(rx - lx, ry - ly))

    # Vertical periorbital height vs palpebral opening ratio
    l_peri_h = abs(landmarks[23].y - landmarks[27].y) * height
    r_peri_h = abs(landmarks[253].y - landmarks[257].y) * height
    l_open_h = abs(landmarks[145].y - landmarks[159].y) * height
    r_open_h = abs(landmarks[374].y - landmarks[386].y) * height

    peri_norm = ((l_peri_h + r_peri_h) * 0.5) / iod
    open_norm = ((l_open_h + r_open_h) * 0.5) / iod

    # Soft tissue shading / puffiness gradient inside periorbital ROI
    gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)
    mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.fillPoly(mask, [left_peri], 255)
    cv2.fillPoly(mask, [right_peri], 255)
    roi_vals = gray[mask == 255]
    contrast_factor = float(np.std(roi_vals) / 45.0) if len(roi_vals) > 0 else 0.5

    # Calibrated around ~100 for standardized neutral face
    ratio_term = (peri_norm / max(0.03, open_norm)) * 24.0
    index_val = 68.0 + ratio_term + contrast_factor * 14.0
    return round(float(np.clip(index_val, 60.0, 175.0)), 2)


def _estimate_head_pose(landmarks: Any, width: int, height: int) -> Tuple[float, float]:
    # Roll from eye centers (33 left outer, 263 right outer)
    lx, ly = landmarks[33].x * width, landmarks[33].y * height
    rx, ry = landmarks[263].x * width, landmarks[263].y * height
    roll_deg = math.degrees(math.atan2(ry - ly, rx - lx))

    # Yaw proxy from nose tip (1) horizontal asymmetry relative to eye midpoint
    mid_x = 0.5 * (lx + rx)
    iod = max(1.0, math.hypot(rx - lx, ry - ly))
    nose_x = landmarks[1].x * width
    yaw_deg = ((nose_x - mid_x) / (iod * 0.5)) * 38.0
    return round(yaw_deg, 2), round(roll_deg, 2)


def _render_overlay(
    bgr_img: np.ndarray,
    landmarks: Any,
    left_eye: np.ndarray,
    right_eye: np.ndarray,
    left_peri: np.ndarray,
    right_peri: np.ndarray,
    quality_score: float,
    yaw_deg: float,
    roll_deg: float,
) -> np.ndarray:
    canvas = bgr_img.copy()
    h, w = canvas.shape[:2]

    # Subtle NASA cyan mesh dots (468 landmarks)
    for lm in landmarks:
        px, py = int(lm.x * w), int(lm.y * h)
        if 0 <= px < w and 0 <= py < h:
            cv2.circle(canvas, (px, py), 1, (248, 189, 56), -1)  # BGR cyan-ish

    # Periorbital ROI polygons (amber) & eye contours (bright cyan)
    cv2.polylines(canvas, [left_peri], True, (11, 158, 245), 1, cv2.LINE_AA)
    cv2.polylines(canvas, [right_peri], True, (11, 158, 245), 1, cv2.LINE_AA)
    cv2.polylines(canvas, [left_eye], True, (255, 229, 0), 2, cv2.LINE_AA)
    cv2.polylines(canvas, [right_eye], True, (255, 229, 0), 2, cv2.LINE_AA)

    # Inter-ocular alignment axis
    p1 = (int(landmarks[33].x * w), int(landmarks[33].y * h))
    p2 = (int(landmarks[263].x * w), int(landmarks[263].y * h))
    cv2.line(canvas, p1, p2, (129, 185, 16), 1, cv2.LINE_AA)

    # HUD stamp
    hud_text = f"ASTRA-CV | Q:{quality_score:.2f} | YAW:{yaw_deg:+.1f}deg | ROLL:{roll_deg:+.1f}deg"
    cv2.rectangle(canvas, (10, 10), (min(w - 10, 520), 38), (10, 14, 22), -1)
    cv2.putText(
        canvas,
        hud_text,
        (18, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (255, 229, 0),
        1,
        cv2.LINE_AA,
    )
    return canvas


def analyze_vision_image(
    astronaut_id: str,
    image_bytes: bytes,
    filename: str = "capture.png",
    is_synthetic: bool = False,
    db_path: Path = DB_PATH,
) -> VisionAnalysisResponse:
    """Analyze a face image against the astronaut's baseline and persist the result."""
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr_img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr_img is None:
        raise ValueError("Unsupported or corrupted image file. Use JPG, JPEG, or PNG.")

    h, w = bgr_img.shape[:2]
    run_id = uuid.uuid4().hex[:10]
    src_name = f"vision_src_{astronaut_id}_{run_id}.png"
    src_path = UPLOADS_DIR / src_name
    cv2.imwrite(str(src_path), bgr_img)
    src_url = f"/api/media/uploads/{src_name}"

    gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
    sharpness = round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 2)
    brightness = round(float(np.mean(gray)), 2)

    # Fetch baseline for astronaut
    with db_session(db_path) as conn:
        row = conn.execute(
            "SELECT periorbital_index, eye_redness_index FROM baselines WHERE astronaut_id = ?",
            (astronaut_id,),
        ).fetchone()
        if row is None:
            raise LookupError(f"Astronaut '{astronaut_id}' not found.")
        base_periorbital = float(row["periorbital_index"])
        base_redness = float(row["eye_redness_index"])

    rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_img)
    landmarker = _get_landmarker()
    result = landmarker.detect(mp_image)

    # Quality Gate 1: Face detection
    if not result.face_landmarks:
        response = VisionAnalysisResponse(
            astronaut_id=astronaut_id,
            timestamp=now_iso,
            status="no_face_detected",
            error_code="no_face_detected",
            error_detail="No clear frontal face detected. Ensure full face is visible and evenly lit.",
            image_quality=round(min(0.3, sharpness / 200.0), 2),
            measurements=VisionMeasurements(
                sharpness_score=sharpness,
                brightness_score=brightness,
                face_confidence=0.0,
            ),
            anomalies=["no_face_detected"],
            requires_follow_up=False,
            source_image_url=src_url,
            overlay_image_url=src_url,
            is_synthetic=is_synthetic,
        )
        _save_vision_row(response, db_path)
        return response

    landmarks = result.face_landmarks[0]
    yaw_deg, roll_deg = _estimate_head_pose(landmarks, w, h)

    # Compute normalized quality score [0, 1]
    res_ok = w >= VISION_THRESHOLDS["min_width"] and h >= VISION_THRESHOLDS["min_height"]
    sharp_norm = min(1.0, sharpness / 120.0)
    bright_ok = VISION_THRESHOLDS["min_brightness"] <= brightness <= VISION_THRESHOLDS["max_brightness"]
    bright_norm = 1.0 - min(1.0, abs(brightness - 128.0) / 128.0)
    pose_penalty = min(0.6, (abs(yaw_deg) / 45.0 + abs(roll_deg) / 45.0) * 0.5)
    image_quality = round(
        float(np.clip(0.45 * sharp_norm + 0.35 * bright_norm + 0.20 * (1.0 - pose_penalty), 0.05, 0.99)),
        2,
    )

    quality_reasons: List[str] = []
    if not res_ok:
        quality_reasons.append(f"resolution too low ({w}x{h})")
    if sharpness < VISION_THRESHOLDS["min_laplacian_sharpness"]:
        quality_reasons.append(f"image blurry (sharpness {sharpness})")
    if not bright_ok:
        quality_reasons.append(f"poor lighting/exposure (brightness {brightness})")
    if abs(yaw_deg) > VISION_THRESHOLDS["max_head_yaw_deg"]:
        quality_reasons.append(f"head yaw too large ({yaw_deg:+.1f} deg)")
    if abs(roll_deg) > VISION_THRESHOLDS["max_head_roll_deg"]:
        quality_reasons.append(f"head tilt too large ({roll_deg:+.1f} deg)")

    left_eye = _polygon_points(landmarks, LEFT_EYE_CONTOUR, w, h)
    right_eye = _polygon_points(landmarks, RIGHT_EYE_CONTOUR, w, h)
    left_peri = _polygon_points(landmarks, LEFT_PERIORBITAL, w, h)
    right_peri = _polygon_points(landmarks, RIGHT_PERIORBITAL, w, h)

    overlay_bgr = _render_overlay(
        bgr_img, landmarks, left_eye, right_eye, left_peri, right_peri, image_quality, yaw_deg, roll_deg
    )
    overlay_name = f"vision_overlay_{astronaut_id}_{run_id}.png"
    overlay_path = OVERLAYS_DIR / overlay_name
    cv2.imwrite(str(overlay_path), overlay_bgr)
    overlay_url = f"/api/media/overlays/{overlay_name}"

    if quality_reasons:
        response = VisionAnalysisResponse(
            astronaut_id=astronaut_id,
            timestamp=now_iso,
            status="low_image_quality",
            error_code="low_image_quality",
            error_detail="Capture unsuitable for baseline comparison: " + "; ".join(quality_reasons) + ".",
            image_quality=image_quality,
            measurements=VisionMeasurements(
                head_yaw_deg=yaw_deg,
                head_roll_deg=roll_deg,
                sharpness_score=sharpness,
                brightness_score=brightness,
                face_confidence=0.85,
            ),
            anomalies=["low_image_quality"],
            requires_follow_up=False,
            source_image_url=src_url,
            overlay_image_url=overlay_url,
            is_synthetic=is_synthetic,
        )
        _save_vision_row(response, db_path)
        return response

    periorbital_idx = _compute_periorbital_index(rgb_img, landmarks, left_peri, right_peri, w, h)
    redness_idx = _compute_eye_redness(rgb_img, left_eye, right_eye)

    peri_delta_pct = round(((periorbital_idx - base_periorbital) / max(1.0, base_periorbital)) * 100.0, 2)
    red_delta_pct = round(((redness_idx - base_redness) / max(1.0, base_redness)) * 100.0, 2)

    anomalies: List[str] = []
    if abs(peri_delta_pct) >= VISION_THRESHOLDS["periorbital_yellow_pct"]:
        anomalies.append("periorbital_change")
    if red_delta_pct >= VISION_THRESHOLDS["redness_yellow_pct"]:
        anomalies.append("eye_redness_elevation")

    requires_follow_up = len(anomalies) > 0

    response = VisionAnalysisResponse(
        astronaut_id=astronaut_id,
        timestamp=now_iso,
        status="ok",
        image_quality=image_quality,
        measurements=VisionMeasurements(
            periorbital_index=periorbital_idx,
            eye_redness_index=redness_idx,
            head_yaw_deg=yaw_deg,
            head_roll_deg=roll_deg,
            sharpness_score=sharpness,
            brightness_score=brightness,
            face_confidence=0.96,
        ),
        baseline_comparison={
            "periorbital_change_percent": peri_delta_pct,
            "eye_redness_change_percent": red_delta_pct,
        },
        anomalies=anomalies,
        requires_follow_up=requires_follow_up,
        source_image_url=src_url,
        overlay_image_url=overlay_url,
        is_synthetic=is_synthetic,
    )
    saved_id = _save_vision_row(response, db_path)
    response.id = saved_id
    return response


def _save_vision_row(res: VisionAnalysisResponse, db_path: Path) -> int:
    with db_session(db_path) as conn:
        cur = conn.execute(
            """
            INSERT INTO vision_analyses (
                astronaut_id, timestamp, status, error_code, error_detail,
                image_quality, measurements_json, baseline_comparison_json,
                anomalies_json, requires_follow_up, source_image_url, overlay_image_url, is_synthetic
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                res.astronaut_id,
                res.timestamp,
                res.status,
                res.error_code,
                res.error_detail,
                res.image_quality,
                res.measurements.model_dump_json(),
                json.dumps(res.baseline_comparison),
                json.dumps(res.anomalies),
                1 if res.requires_follow_up else 0,
                res.source_image_url,
                res.overlay_image_url,
                1 if res.is_synthetic else 0,
            ),
        )
        conn.execute(
            """
            INSERT INTO offline_sync_queue (astronaut_id, module, payload_summary, status, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                res.astronaut_id,
                "vision",
                f"status={res.status}, quality={res.image_quality}, anomalies={len(res.anomalies)}",
                "queued_offline",
                res.timestamp,
            ),
        )
        return int(cur.lastrowid)
