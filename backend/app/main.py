import base64
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Ensure project root is in sys.path to access the existing cv package
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Reuse existing CV modules without duplicating their logic
from cv.cat_matcher import get_memes_base_dir, match_cat
from cv.expression_classifier import classify_expression
from cv.face_landmarks import get_model_path
from cv.facial_features import (
    LEFT_EYE_BOTTOM_1,
    LEFT_EYE_BOTTOM_2,
    LEFT_EYE_CORNER_INNER,
    LEFT_EYE_CORNER_OUTER,
    LEFT_EYE_TOP_1,
    LEFT_EYE_TOP_2,
    REF_EYE_OUTER_LEFT,
    REF_EYE_OUTER_RIGHT,
    RIGHT_EYE_BOTTOM_1,
    RIGHT_EYE_BOTTOM_2,
    RIGHT_EYE_CORNER_INNER,
    RIGHT_EYE_CORNER_OUTER,
    RIGHT_EYE_TOP_1,
    RIGHT_EYE_TOP_2,
    calculate_ear,
    calculate_mar,
    calculate_mouth_width,
    calculate_smile_measurement,
    euclidean_distance,
    get_pixel_landmarks,
)
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Global detector instance for high-throughput reuse
landmarker: Optional[vision.FaceLandmarker] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes and manages the lifetime of the MediaPipe FaceLandmarker."""
    global landmarker
    try:
        model_path = get_model_path()
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        landmarker = vision.FaceLandmarker.create_from_options(options)
    except Exception as exc:
        print(f"Warning: Failed to initialize MediaPipe FaceLandmarker: {exc}")

    yield

    if landmarker:
        try:
            landmarker.close()
        except Exception:
            pass


app = FastAPI(
    title="Purrsonality CV API",
    description="Bridge API between the Purrsonality React frontend and the Python CV pipeline.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for local development and configurable production origins
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Read CORS_ORIGINS from environment (comma-separated), e.g. "https://purrsonality.vercel.app,http://localhost:5173"
cors_env = os.environ.get("CORS_ORIGINS", "")
if cors_env.strip():
    configured_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
    ALLOWED_ORIGINS = list(dict.fromkeys(DEFAULT_ALLOWED_ORIGINS + configured_origins))
else:
    ALLOWED_ORIGINS = DEFAULT_ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local memes directory for browser static-file serving (/memes/<category>/<filename>)
memes_directory = get_memes_base_dir()
if memes_directory.exists() and memes_directory.is_dir():
    app.mount("/memes", StaticFiles(directory=str(memes_directory)), name="memes")


# ==============================================================================
# Pydantic Request & Response Schemas
# ==============================================================================

class PredictRequest(BaseModel):
    image: str = Field(
        ...,
        description="Base64 encoded webcam image (e.g. data:image/jpeg;base64,... or raw base64)",
    )


class PredictionItem(BaseModel):
    label: str
    confidence: float = Field(
        ...,
        description="Deterministic heuristic confidence score for rule-based match (not ML probability)",
    )


class CatResponse(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    image_path: Optional[str] = None
    image_url: Optional[str] = None
    caption: Optional[str] = None


class FeaturesResponse(BaseModel):
    ear_avg: float
    mar: float
    mouth_width: float
    smile: float


class PredictResponse(BaseModel):
    predictions: List[PredictionItem]
    bbox: Optional[List[int]] = None
    cat: Optional[CatResponse] = None
    features: Optional[FeaturesResponse] = None
    frame_size: Optional[List[int]] = None


# ==============================================================================
# Helper Utilities
# ==============================================================================

def decode_base64_image(image_str: str) -> np.ndarray:
    """
    Safely decodes a base64 string into an OpenCV BGR image matrix.
    Raises ValueError on invalid input or unreadable image data.
    """
    if not image_str or not isinstance(image_str, str):
        raise ValueError("Image string must be a non-empty string.")

    # Strip data URL prefix if present
    if "," in image_str:
        _, b64_data = image_str.split(",", 1)
    else:
        b64_data = image_str

    try:
        image_bytes = base64.b64decode(b64_data.strip())
    except Exception as exc:
        raise ValueError(f"Invalid base64 payload: {exc}") from exc

    if not image_bytes:
        raise ValueError("Decoded image bytes are empty.")

    np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Could not decode image bytes into an OpenCV matrix.")

    return image


def build_image_url(image_path: Optional[str]) -> Optional[str]:
    """Converts a local file path into a static URL path (/memes/category/filename)."""
    if not image_path:
        return None
    try:
        memes_base = get_memes_base_dir()
        p = Path(image_path)
        full_path = PROJECT_ROOT / image_path if not p.is_absolute() else p
        rel_to_memes = full_path.resolve().relative_to(memes_base.resolve()).as_posix()
        return f"/memes/{rel_to_memes}"
    except Exception:
        parts = Path(image_path).parts
        if len(parts) >= 2:
            return f"/memes/{parts[-2]}/{parts[-1]}"
        return f"/memes/{Path(image_path).name}"


# ==============================================================================
# API Endpoints
# ==============================================================================

@app.get("/health", summary="Health Check")
async def health():
    """Health check endpoint to verify backend service readiness."""
    return {"status": "ok"}


@app.post(
    "/predict",
    response_model=PredictResponse,
    summary="Predict Facial Expression and Cat Meme",
)
async def predict(payload: PredictRequest):
    """
    Accepts a base64-encoded webcam frame, runs facial landmark detection,
    calculates geometric features, classifies the expression, and matches a cat meme.
    """
    global landmarker
    if landmarker is None:
        model_path = get_model_path()
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
        )
        landmarker = vision.FaceLandmarker.create_from_options(options)

    # 1. Decode incoming base64 image
    try:
        frame = decode_base64_image(payload.image)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image decoding failed: {val_err}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unexpected error while reading image: {exc}",
        )

    height, width, _ = frame.shape

    # 2. Run MediaPipe face landmark detection
    try:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        detection_result = landmarker.detect(mp_image)
    except Exception as proc_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Face landmarker processing error: {proc_err}",
        )

    # 3. Handle No-Face detection gracefully
    if not detection_result.face_landmarks or len(detection_result.face_landmarks) == 0:
        no_face_cat = match_cat("No Face")
        return PredictResponse(
            predictions=[],
            bbox=None,
            cat=CatResponse(
                id=no_face_cat.get("id"),
                name=no_face_cat.get("cat_name"),
                image_path=no_face_cat.get("image_path"),
                image_url=build_image_url(no_face_cat.get("image_path")),
                caption=no_face_cat.get("caption"),
            ),
            features=None,
            frame_size=[width, height],
        )

    # 4. Extract landmarks and calculate geometric measurements
    pts = get_pixel_landmarks(detection_result.face_landmarks[0], width, height)

    ear_left = calculate_ear(
        pts,
        LEFT_EYE_CORNER_INNER,
        LEFT_EYE_CORNER_OUTER,
        LEFT_EYE_TOP_1,
        LEFT_EYE_BOTTOM_1,
        LEFT_EYE_TOP_2,
        LEFT_EYE_BOTTOM_2,
    )
    ear_right = calculate_ear(
        pts,
        RIGHT_EYE_CORNER_OUTER,
        RIGHT_EYE_CORNER_INNER,
        RIGHT_EYE_TOP_1,
        RIGHT_EYE_BOTTOM_1,
        RIGHT_EYE_TOP_2,
        RIGHT_EYE_BOTTOM_2,
    )
    ear_avg = (ear_left + ear_right) / 2.0

    iod = euclidean_distance(pts[REF_EYE_OUTER_RIGHT], pts[REF_EYE_OUTER_LEFT])
    mar = calculate_mar(pts)
    mouth_width = calculate_mouth_width(pts, ref_distance=iod)
    smile = calculate_smile_measurement(pts, ref_distance=iod)

    features_dict = {
        "ear_left": ear_left,
        "ear_right": ear_right,
        "ear_avg": ear_avg,
        "mar": mar,
        "mouth_width": mouth_width,
        "smile": smile,
    }

    # 5. Classify expression using the existing rule-based classifier
    label = classify_expression(features_dict)

    # 6. Calculate face bounding box [x, y, width, height]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    min_x, max_x = max(0, int(min(xs))), min(width, int(max(xs)))
    min_y, max_y = max(0, int(min(ys))), min(height, int(max(ys)))
    bbox = [min_x, min_y, max(1, max_x - min_x), max(1, max_y - min_y)]

    # 7. Match expression to real local cat meme
    cat_entry = match_cat(label)
    image_path = cat_entry.get("image_path")
    image_url = build_image_url(image_path)

    # 8. Construct response
    # Deterministic heuristic confidence indicating rule-based match
    deterministic_confidence = 0.95

    return PredictResponse(
        predictions=[
            PredictionItem(label=label, confidence=deterministic_confidence)
        ],
        bbox=bbox,
        cat=CatResponse(
            id=cat_entry.get("id"),
            name=cat_entry.get("cat_name"),
            image_path=image_path,
            image_url=image_url,
            caption=cat_entry.get("caption"),
        ),
        features=FeaturesResponse(
            ear_avg=round(ear_avg, 4),
            mar=round(mar, 4),
            mouth_width=round(mouth_width, 4),
            smile=round(smile, 4),
        ),
        frame_size=[width, height],
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, reload=False)
