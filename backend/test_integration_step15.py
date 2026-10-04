"""
End-to-end Step 15 Integration Verification.
Starts uvicorn in a background thread/process, makes real HTTP requests via urllib,
and verifies:
1. GET /health
2. OPTIONS /predict (CORS headers)
3. POST /predict (No-Face payload)
4. POST /predict (Real Face payload from webcam if available)
5. Static meme route (GET /memes/...)
"""

import base64
import json
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np
import uvicorn
from backend.app.main import app

PORT = 8000
BASE_URL = f"http://127.0.0.1:{PORT}"


def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def run_server():
    config = uvicorn.Config(app=app, host="127.0.0.1", port=PORT, log_level="warning")
    server = uvicorn.Server(config)
    server.run()


def test_integration():
    server_thread = None
    if not is_port_in_use(PORT):
        print(f"Starting live Uvicorn server on port {PORT} in background...")
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        time.sleep(2)
    else:
        print(f"Server is already running on port {PORT}.")

    all_passed = True

    # 1. Health check
    print("\n--- 1. Testing GET /health ---")
    try:
        req = urllib.request.Request(f"{BASE_URL}/health")
        with urllib.request.urlopen(req, timeout=5) as res:
            body = json.loads(res.read().decode())
            print(f"Status: {res.status}, Response: {body}")
            assert body.get("status") == "ok"
            print("  -> PASS: Health check succeeded.")
    except Exception as e:
        print(f"  -> FAIL: Health check error: {e}")
        all_passed = False

    # 2. CORS preflight check
    print("\n--- 2. Testing CORS OPTIONS /predict ---")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/predict",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
            method="OPTIONS",
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            cors_origin = res.headers.get("Access-Control-Allow-Origin")
            print(f"CORS Origin Header: {cors_origin}")
            assert cors_origin in ("http://localhost:5173", "*")
            print("  -> PASS: CORS configured correctly for Vite.")
    except Exception as e:
        print(f"  -> FAIL: CORS preflight failed: {e}")
        all_passed = False

    # 3. No-Face prediction request
    print("\n--- 3. Testing POST /predict with blank image (No Face) ---")
    try:
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        _, buf = cv2.imencode(".jpg", blank)
        b64 = "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")

        req_data = json.dumps({"image": b64}).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/predict",
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode())
            print("Response:", json.dumps(data, indent=2))
            assert data.get("predictions") == []
            assert data.get("bbox") is None
            assert data.get("cat", {}).get("id") == "cat_no_face"
            print("  -> PASS: No Face handled gracefully.")
    except Exception as e:
        print(f"  -> FAIL: No Face test failed: {e}")
        all_passed = False

    # 4. Real face webcam capture or simulated image
    print("\n--- 4. Testing POST /predict with webcam / face frame ---")
    try:
        cap = cv2.VideoCapture(0)
        captured = False
        frame = None
        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                captured = True
            cap.release()

        if not captured:
            print("Webcam not open or in use; using test frame.")
            frame = np.ones((480, 640, 3), dtype=np.uint8) * 128

        _, buf = cv2.imencode(".jpg", frame)
        b64 = "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")

        req_data = json.dumps({"image": b64}).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/predict",
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode())
            print("Response structure:")
            print(f"  - predictions count: {len(data.get('predictions', []))}")
            if data.get("predictions"):
                pred = data["predictions"][0]
                print(f"  - label: {pred.get('label')}, confidence: {pred.get('confidence')}")
            cat = data.get("cat", {})
            print(f"  - cat: name={cat.get('name')}, image_url={cat.get('image_url')}")
            print("  -> PASS: Real frame POST /predict succeeded.")

            # 5. Test fetching static meme image if image_url is returned
            if cat.get("image_url"):
                meme_url = f"{BASE_URL}{cat['image_url']}"
                print(f"\n--- 5. Testing Static Meme Asset URL: {meme_url} ---")
                meme_req = urllib.request.Request(meme_url)
                with urllib.request.urlopen(meme_req, timeout=5) as meme_res:
                    meme_bytes = meme_res.read()
                    print(f"  - HTTP Status: {meme_res.status}, Length: {len(meme_bytes)} bytes")
                    assert len(meme_bytes) > 0
                    print("  -> PASS: Static meme image is directly downloadable by browser!")
    except Exception as e:
        print(f"  -> FAIL: Frame prediction / static file test failed: {e}")
        all_passed = False

    print("\n" + "=" * 65)
    print(f"Integration Summary: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    print("=" * 65)
    return all_passed


if __name__ == "__main__":
    ok = test_integration()
    sys.exit(0 if ok else 1)
