# ASTRA — Autonomous Spaceflight Health Intelligence

**ASTRA** is an offline-first, non-Docker **NASA Mission Control** crew health intelligence prototype (`FastAPI` + `SQLite` + `Next.js`). It fuses local computer vision, acoustic/cognitive telemetry, and a transparent digital twin simulator to surface early deviation alerts relative to each astronaut's personal baseline.

> **Scientific Guardrail:** ASTRA is a demonstration & decision-support prototype only. RGB facial metrics do **not** measure intracranial pressure (ICP) or diagnose SANS, speech acoustics do **not** clinically diagnose depression, and Digital Twin projections are linear scenario estimates—not validated flight-surgeon diagnostics.

---

## Core Modules

1. **Astronaut Profile & Baseline (`/astronauts`)**
   - Seeded crew member `AST-001` (**Cmdr. Elena Vance**, *Artemis Orbital Endurance-IV*, `Mission Day 30`) with 30-day explicitly marked `DEMO / SYNTHETIC` history.
   - Custom crew registration, personal baseline calibration, and self-reported mission log entry.
2. **Vision Monitoring (`/vision`)**
   - Real **OpenCV + MediaPipe `FaceLandmarker`** pipeline computing Laplacian sharpness, exposure balance, head orientation, periorbital index, and eye redness index relative to personal baseline.
   - Supports **live browser webcam capture**, image upload (`.jpg`/`.png`), and bundled demo samples, returning visual landmark overlays and explicit rejection states (`no_face_detected`, `low_image_quality`).
3. **Cognitive & Voice Monitoring (`/cognitive`)**
   - Real **Librosa + offline `faster-whisper` (`tiny.en`)** voice analysis (speech rate WPM, pauses, RMS energy, acoustic variability, word repetitions) with quality checks (`noisy_audio`, `audio_too_short`).
   - Supports **live microphone WAV recording** (client-side 16kHz PCM `.wav` encoding via Web Audio API—no `ffmpeg` required), audio file upload, and **3 interactive cognitive tests** (*Reaction Time*, *Memory Sequence*, *Attention Go/No-Go*).
4. **Health Intelligence Fusion (`/intelligence`)**
   - Explainable rule-based multi-signal aggregation (`Green` / `Yellow` / `Red`) across Vision, Audio, Cognitive Tests, and Telemetry, resilient to missing signals (`missing_signals` + `data_completeness` score).
5. **Personal Digital Twin (`/digital-twin`)**
   - Historical + 14-day scenario trajectory and interactive What-If simulator (*Sleep*, *Exercise*, *Nutrition*, *Hydration*, *Workload*) with transparent formulas and assumptions.

---

## Quick Start (Native Local Setup — No Docker)

### Prerequisites
- Python **3.11**
- Node.js **22+ LTS** & `npm`

### 1. Backend Setup
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

*(Optional)* Pre-cache the lightweight offline Whisper `tiny.en` model (~75 MB) into `data/models/whisper/`:
```bash
backend/.venv/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('tiny.en', device='cpu', compute_type='int8', download_root='data/models/whisper')"
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run build
```

### 3. Run Both Services
From the repository root:
```bash
./start.sh
```
- **Mission Control UI:** `http://127.0.0.1:3000`
- **FastAPI Docs:** `http://127.0.0.1:8000/docs`

### 4. Run Backend Smoke Tests
```bash
backend/.venv/bin/pytest -v backend/tests/test_astra_api.py
```

---

## Documentation
- Master Architecture & Phased Plan: [`ASTRA_PLAN.md`](./ASTRA_PLAN.md)
- Product Specification: [`idea.md`](./idea.md)
