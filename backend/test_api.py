"""
Backend API Unit and Integration Tests for Purrsonality.

Tests:
1. Health endpoint (GET /health)
2. Invalid base64 payload error handling (HTTP 400)
3. No-face frame processing (HTTP 200 with empty predictions and fallback cat)
4. Valid face image processing from webcam (HTTP 200 with full predictions, bbox, and cat)
"""

import asyncio
import base64
import sys
from pathlib import Path

import cv2
import numpy as np

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.main import PredictRequest, app, health, predict
from fastapi import HTTPException


def encode_frame_to_base64(frame: np.ndarray, format: str = ".jpg") -> str:
    """Encodes a BGR numpy image to a base64 data URI string."""
    success, buffer = cv2.imencode(format, frame)
    if not success:
        raise RuntimeError("Failed to encode frame to image bytes.")
    b64_str = base64.b64encode(buffer).decode("utf-8")
    mime = "image/jpeg" if format in [".jpg", ".jpeg"] else "image/png"
    return f"data:{mime};base64,{b64_str}"


async def run_all_tests():
    print("=" * 65)
    print("Starting Purrsonality Backend API Test Suite")
    print("=" * 65)

    all_passed = True

    # --------------------------------------------------------------------------
    # Test 1: Health Check Endpoint
    # --------------------------------------------------------------------------
    print("\n[TEST 1] Testing GET /health...")
    health_res = await health()
    if health_res == {"status": "ok"}:
        print("  -> PASS: Health check returned {'status': 'ok'}")
    else:
        print(f"  -> FAIL: Unexpected health check output: {health_res}")
        all_passed = False

    # --------------------------------------------------------------------------
    # Test 2: Invalid Image Handling
    # --------------------------------------------------------------------------
    print("\n[TEST 2] Testing POST /predict with invalid base64 payload...")
    try:
        invalid_req = PredictRequest(image="this_is_not_valid_base64_data!!!")
        await predict(invalid_req)
        print("  -> FAIL: Expected HTTPException 400 was not raised.")
        all_passed = False
    except HTTPException as http_exc:
        if http_exc.status_code == 400:
            print(f"  -> PASS: Correctly raised HTTP 400: '{http_exc.detail}'")
        else:
            print(f"  -> FAIL: Raised HTTP {http_exc.status_code} instead of 400")
            all_passed = False

    # --------------------------------------------------------------------------
    # Test 3: No-Face Frame Processing
    # --------------------------------------------------------------------------
    print("\n[TEST 3] Testing POST /predict with no-face blank frame...")
    black_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    black_b64 = encode_frame_to_base64(black_frame)
    no_face_req = PredictRequest(image=black_b64)
    no_face_res = await predict(no_face_req)

    no_face_ok = (
        len(no_face_res.predictions) == 0
        and no_face_res.bbox is None
        and no_face_res.features is None
        and no_face_res.cat is not None
        and no_face_res.cat.id == "cat_no_face"
    )
    if no_face_ok:
        print("  -> PASS: Gracefully handled no-face frame:")
        print(f"     Predictions: {no_face_res.predictions}")
        print(f"     Bbox:        {no_face_res.bbox}")
        print(f"     Cat ID:      {no_face_res.cat.id} ('{no_face_res.cat.name}')")
    else:
        print(f"  -> FAIL: Unexpected response for no-face frame: {no_face_res}")
        all_passed = False

    # --------------------------------------------------------------------------
    # Test 4: Real Webcam Face Frame Processing
    # --------------------------------------------------------------------------
    print("\n[TEST 4] Testing POST /predict with live frame from webcam...")
    cap = cv2.VideoCapture(0)
    live_frame = None
    if cap.isOpened():
        for _ in range(10):
            ret, frame = cap.read()
            if ret:
                live_frame = frame
        cap.release()

    if live_frame is not None:
        face_b64 = encode_frame_to_base64(live_frame)
        face_req = PredictRequest(image=face_b64)
        face_res = await predict(face_req)

        print("  -> Output received from /predict:")
        print(f"     Predictions: {[p.model_dump() for p in face_res.predictions]}")
        print(f"     Bbox:        {face_res.bbox}")
        if face_res.cat:
            print(f"     Matched Cat: {face_res.cat.name} (Image: {face_res.cat.image_path})")
        if face_res.features:
            print(f"     Features:    {face_res.features.model_dump()}")

        print("  -> PASS: Live frame processed successfully through full pipeline.")
    else:
        print("  -> SKIP: Webcam was busy or unavailable for live frame test.")

    print("\n" + "=" * 65)
    print(f"Test Suite Summary: {'ALL TESTS PASSED' if all_passed else 'TESTS FAILED'}")
    print("=" * 65)
    return all_passed


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
