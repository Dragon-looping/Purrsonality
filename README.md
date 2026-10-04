# Purrsonality 🐱⚡
> *"Your face. Your vibe. Your Purrsonality."*

A chaotic, neo-brutalist computer vision meme web app that analyzes your facial expression through a webcam and matches you with your feline soulmate.

---

## Frontend Setup & Quickstart

The frontend is built with React, Vite, TypeScript, Tailwind CSS, Framer Motion, and Zustand.

### 1. Install Dependencies
From the repository root (or inside the `frontend/` directory):
```bash
npm install
```

### 2. Configure Environment
A `.env` file is located in `frontend/.env`:
```bash
# Enable mock analysis mode (default in Step 13, no backend required)
VITE_MOCK=true
```

When `VITE_MOCK=true`, the scan screen simulates high-speed facial predictions using randomized meme categories (Grumpy, Shook, Banana, Popcat, Smug, etc.) without requiring a live CV backend.

### 3. Run Development Server
```bash
npm run dev
```

Visit the displayed local server URL (typically `http://localhost:5173`) in your browser to experience the arcade interface.

---

## Computer Vision Engine (Python)

The Computer Vision engine is located under `cv/`:
- `cv/face_detection.py`: OpenCV Haar Cascade frontal-face classifier baseline.
- `cv/face_landmarks.py`: Real-time 478 3D MediaPipe Face Landmarker.
- `cv/facial_features.py`: Eye Aspect Ratio (EAR), Mouth Aspect Ratio (MAR), and smile curvature measurements.
- `cv/expression_classifier.py`: Rule-based expression classifier (`Neutral`, `Happy`, `Surprised`, `Eyes Closed`).
- `cv/cat_matcher.py`: Real local cat meme image discovery and random selector.
- `cv/purrsonality.py`: Integrated live desktop pipeline with side-by-side HUD display.
