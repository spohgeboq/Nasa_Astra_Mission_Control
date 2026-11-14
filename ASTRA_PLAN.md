# ASTRA — Autonomous Spaceflight Health Intelligence
## Master Brainstorm, Cosmic Design Architecture & Phased Development Plan

> **Mission Statement:** Build a working, **offline-first**, **non-Docker** full-stack MVP of ASTRA (`Next.js` + `FastAPI` + `SQLite`) in **English**, combining real local Computer Vision (`OpenCV` + `MediaPipe`), real Audio/Cognitive analytics (`Librosa` + local STT + interactive cognitive tasks), explainable multi-signal Health Intelligence, and a transparent Digital Twin simulator — wrapped in a bespoke **NASA Mission Control** cosmic UI.

---

## 1. Locked Decisions & Constraints

| Dimension | Decision | Rationale |
|---|---|---|
| **Deployment / Runtime** | **Strictly NO Docker.** Native local macOS (`arm64`) execution via `venv` + `npm` and a one-command `./start.sh` launcher. | Explicit user requirement; fastest iteration and direct access to local filesystem/hardware. |
| **UI Language** | **100% English** across all pages, labels, charts, alerts, and disclaimers. | Authentic NASA Mission Control / Crew Dragon telemetry aesthetic. |
| **Live Media Capture** | **Browser Webcam + Microphone recording** in addition to drag-and-drop file upload (`.jpg/.png`, `.wav/.mp3`). | Enables live real-time hackathon demos; browser mic encodes **16kHz PCM `.wav` directly via Web Audio API** so Python analyzes recordings without needing `ffmpeg`. |
| **Offline-First Guarantee** | Zero mandatory cloud APIs. SQLite local DB, self-hosted fonts (`woff2`), local CV/Audio processing, and an explicit `LOCAL / OFFLINE-FIRST` status + sync queue indicator. | Spacecraft autonomy requirement from `idea.md`. |
| **Engineering Rule: No Fake AI** | Every metric is computed by real algorithms (OpenCV/MediaPipe, Librosa, numpy/scikit-learn, deterministic fusion & trend math). Synthetic demo histories are explicitly labeled `DEMO / SYNTHETIC`. | Prevents jury distrust and satisfies `idea.md` §24–27. |
| **Scientific Honesty** | Explicit non-diagnostic banners in Vision (RGB ≠ ICP / SANS diagnosis), Cognitive (voice ≠ depression diagnosis), and Health Intelligence / Digital Twin (demo thresholds & scenario estimates). | Clinical/aerospace safety compliance per `idea.md` §19. |

---

## 2. Cosmic Design System (`design-taste-frontend` + `high-end-visual-design`)

### 2.1 Visual Identity: "Orbital Flight Deck"
- **Surface Hierarchy (OLED Deep Space):**
  - Primary Space Void: `#04060A`
  - Elevated Instrument Core: `#080C14`
  - Recessed Telemetry Well: `#0D131F`
- **Signal & Accent Palette (Zero Violet/Lavender AI-Slop):**
  - Primary Telemetry Cyan: `#38BDF8` (NASA ice-blue) / `#00E5FF` (active scanline & pulse)
  - Lunar Titanium Ink: `#F1F5F9` (primary text), `#94A3B8` (telemetry labels), `#475569` (grid hairlines)
  - Semantic Flight Status:
    - `GREEN` (Nominal): `#10B981`
    - `YELLOW` (Advisory / Re-check): `#F59E0B`
    - `RED` (Critical / Flight Surgeon Review): `#EF4444`
- **Typography (Self-Hosted for Offline Mode):**
  - Display & UI Headings: **Space Grotesk** (clean aerospace geometry; zero `Inter`/`Roboto`/`Arial`)
  - Telemetry, IDs (`AST-001`), Timestamps, Formulas: **JetBrains Mono** (`font-variant-numeric: tabular-nums`)

### 2.2 Haptic & Spatial Architecture
- **Double-Bezel (Doppelrand) Hardware Housings:** Every major module card uses a two-layer machined enclosure:
  - Outer chassis (`bg-white/[0.03]`, `ring-1 ring-white/[0.08]`, `p-1.5`, `rounded-[1.75rem]`)
  - Inner glass core (`bg-[#080C14]`, `rounded-[calc(1.75rem-0.375rem)]`, `shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]`)
- **Button-in-Button Pill CTAs:** Primary actions use full pill containers with a nested circular icon badge that translates diagonally on hover.
- **Floating Island Mission Header:** Detached top navigation pill (`backdrop-blur-2xl`) showing active astronaut (`AST-001`), `Mission Day 30`, live `LOCAL / OFFLINE-FIRST` indicator, and route navigation.
- **Cosmic Motion Choreography:** Custom `cubic-bezier(0.32, 0.72, 0, 1)` transitions, subtle orbital radar/grid SVG backdrops, GPU-only `transform`/`opacity` animations, and `prefers-reduced-motion` support.
- **Responsive Collapse:** Graceful fallback below `768px` to single-column layouts (`w-full`, `px-4`, `44px+` touch targets, zero horizontal overflow at `390px` and `320px`).

---

## 3. System Architecture & Data Flow

```text
astra/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, static artifact serving
│   │   ├── config.py                # Paths, offline flags, demo threshold constants
│   │   ├── database.py              # SQLite connection & schema initialization
│   │   ├── schemas/                 # Strict Pydantic v2 request/response contracts
│   │   ├── routes/
│   │   │   ├── astronauts.py        # Profile CRUD, baseline updates, telemetry history
│   │   │   ├── vision.py            # Image upload/capture -> CV analysis + overlay image
│   │   │   ├── cognitive.py         # Audio upload/mic WAV -> acoustics/STT + cognitive tests
│   │   │   ├── intelligence.py      # Multi-signal fusion engine + latest status
│   │   │   └── digital_twin.py      # 14-day forecast + What-if simulation
│   │   └── services/
│   │       ├── seed_service.py      # AST-001 seeded baseline & 30-day synthetic history
│   │       ├── vision_service.py    # OpenCV quality checks + MediaPipe Face Mesh metrics
│   │       ├── audio_service.py     # Librosa acoustic features + faster-whisper local STT
│   │       ├── intelligence_service.py # Baseline comparison, missing-data & rule engine
│   │       └── twin_service.py      # Transparent time-series trend + What-if math
│   ├── tests/                       # Pytest unit & integration smoke tests
│   └── requirements.txt
├── frontend/
│   ├── public/fonts/                # Self-hosted Space Grotesk & JetBrains Mono
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Redirect / Mission Control Overview (/dashboard)
│   │   │   ├── dashboard/           # Unified Mission Control HUD
│   │   │   ├── astronauts/          # Profile, Medical Context, Baseline & Logs
│   │   │   ├── vision/              # Webcam Capture + Upload + Landmark Overlay
│   │   │   ├── cognitive/           # Mic WAV Recorder + Upload + 3 Cognitive Tasks
│   │   │   ├── intelligence/        # Health Intelligence Fusion & Recommendations
│   │   │   └── digital-twin/        # 14-Day Projection & What-If Simulator
│   │   ├── components/              # DoubleBezelCard, OrbitalNav, Charts, Recorders
│   │   └── lib/                     # Typed API client, WAV encoder, formatters
├── data/
│   ├── demo/                        # Pre-seeded good/altered/bad images & audio clips
│   └── uploads/                     # Local persisted captures & landmark overlays
├── start.sh                         # One-command native macOS launcher (Backend + Frontend)
└── ASTRA_PLAN.md                    # This master plan
```

### Key Technical Innovations
1. **Zero-`ffmpeg` Browser Mic Recording:** Frontend records microphone PCM frames via `AudioContext` + `ScriptProcessor`/`AudioWorklet` and writes a standard RIFF `.wav` header directly in JavaScript (`16kHz`, mono, 16-bit PCM). Both `soundfile`/`librosa` and `faster-whisper` consume `.wav` natively offline.
2. **Visual Proof in Vision Monitoring:** `vision_service.py` does not just return numbers — it draws the MediaPipe eye/periorbital ROI mesh and quality telemetry onto a saved preview image and returns its URL so the user sees exact facial landmark alignment in the UI.
3. **Explicit Error Contracts:** Low-quality inputs never silently fabricate scores. Vision returns `no_face_detected` or `low_image_quality` (blur/exposure/head-tilt reasons); Audio returns `noisy_audio` or `audio_too_short`.
4. **Resilient Multi-Signal Fusion:** Health Intelligence runs cleanly even if only 1 of 3 modules has recent measurements, explicitly listing `missing_signals` and lowering data completeness confidence.

---

## 4. Phased Development Roadmap

### Stage 0 — Environment & Toolchain Setup (No Docker)
- [x] Verify/install **Node.js (v22+ LTS)** via Homebrew (`brew install node`) for Next.js + UI verification scripts.
- [x] Verify/install **Python 3.11+** (via `brew install python@3.11` if needed for clean arm64 `mediapipe`/`faster-whisper` wheels) and create `backend/.venv`.
- [x] Install Python dependencies (`fastapi`, `uvicorn[standard]`, `python-multipart`, `pydantic`, `opencv-python`, `mediapipe`, `librosa`, `soundfile`, `numpy`, `scikit-learn`, `faster-whisper`, `pytest`, `httpx`).
- [x] Pre-cache lightweight local STT model (`faster-whisper` `tiny.en`) if approved, with graceful fallback if absent.
- [x] Initialize `frontend/` Next.js (App Router, TypeScript, Tailwind CSS, Recharts) and configure self-hosted fonts.

### Stage 1 — Database Schema, Contracts & `AST-001` Demo Seed
- [x] Design and implement SQLite schema (`astronauts`, `baselines`, `telemetry_records`, `vision_analyses`, `cognitive_audio_analyses`, `cognitive_test_results`, `intelligence_reports`, `twin_scenarios`, `sync_queue`).
- [x] Define strict Pydantic v2 schemas matching `idea.md` §12 (`astronaut_id`, `module`, `timestamp`, `data_quality`, `measurements`, `baseline_comparison`, `anomalies`, `is_synthetic`).
- [x] Implement `POST /api/astronauts`, `GET /api/astronauts`, `GET /api/astronauts/{id}`, `PUT /api/astronauts/{id}/baseline`, `POST /api/astronauts/{id}/telemetry`.
- [x] Build `seed_service.py`: populate `AST-001` (Commander Elena Vance, Mission Day 30, Artemis-Lunar Orbital Endurance) with 30 days of `DEMO / SYNTHETIC` sleep, heart rate, activity, hydration, and cognitive test history.
- [x] Generate/prepare local demo media pack in `data/demo/` (standardized baseline face sample, subtle periorbital shift sample, blurry/occluded bad sample; clean English voice `.wav` sample + noisy/clipped bad `.wav` sample).

### Stage 2 — Real CV & Cognitive Processing Services
- [x] **Vision Service (`vision_service.py`):**
  - Image format validation (`JPG/JPEG/PNG`).
  - Quality scoring: Laplacian sharpness, exposure balance, face presence, head yaw/pitch/roll angle estimation.
  - MediaPipe Face Mesh landmark extraction -> periorbital geometry index & eye-area redness index.
  - Baseline comparison (% delta), anomaly flags (`periorbital_change`, `eye_redness_elevation`), `requires_follow_up`, and rendered landmark overlay image saved locally.
  - Explicit rejection codes: `no_face_detected`, `low_image_quality`.
- [x] **Cognitive Audio Service (`audio_service.py`):**
  - Audio validation (`.wav`, `.mp3`), duration, SNR/clipping check (`noisy_audio` error handling).
  - `librosa` extraction: speech rate (syllable/onset proxy), mean/total pause duration, RMS voice energy, pitch/acoustic variability, word repetition ratio from transcript.
  - Local `faster-whisper` transcription (with clean offline deterministic fallback when audio is synthetic/model unavailable).
- [x] **Cognitive Tests API (`POST /api/cognitive/test-result`):**
  - Persist `reaction_time`, `memory`, and `attention` scores with baseline `% delta`.
- [x] Write `pytest` verification tests for Vision, Audio, and edge/error cases.

### Stage 3 — Health Intelligence Engine & Digital Twin Simulator
- [x] **Health Intelligence (`intelligence_service.py`):**
  - Aggregate latest Vision, Cognitive Audio, Cognitive Tests, and Biometric/Sleep telemetry against `AST-001` baseline.
  - Detect missing sources (`missing_signals`) without crashing.
  - Transparent rule engine -> `Green` / `Yellow` / `Red`, per-signal data quality score, human-readable factor breakdown, and prioritized follow-up recommendations.
  - Persist runs in SQLite (`POST /api/intelligence/run`, `GET /api/intelligence/{id}/latest`).
- [x] **Digital Twin (`twin_service.py`):**
  - Historical series aggregator (`GET /api/digital-twin/{id}/forecast`).
  - Transparent 14-day projection model (weighted trend + sleep/load coupling + uncertainty bounds `±CI`).
  - Interactive What-If simulator (`POST /api/digital-twin/simulate`) accepting `sleep_hours`, `exercise_load`, `nutrition_score`, `hydration_liters`, `workload_level` and returning `baseline_scenario` vs `adjusted_scenario` + explicit formula assumptions.
- [x] Complete backend `pytest` suite covering full end-to-end API pipeline & persistence across restarts.

### Stage 4 — Cosmic Frontend Design System & Mission Control Shell
- [x] Configure Tailwind theme tokens, self-hosted `Space Grotesk` + `JetBrains Mono`, cosmic grid/starfield subtle layers, and `DoubleBezelCard` / `ButtonInButton` / `StatusPill` / `DisclaimerBanner` components.
- [x] Build Floating Island Navigation + Astronaut Switcher (`AST-001`) + Create New Astronaut modal + `LOCAL / OFFLINE-FIRST` status badge & sync queue drawer.
- [x] Build **Dashboard (`/dashboard`)**: mission overview, crew status ring, active alerts, latest Vision & Cognitive summaries, Health Intelligence banner, quick jump to What-If simulator, and telemetry trend charts.
- [x] Build **Astronaut Profile (`/astronauts`)**: medical history, Mission Day counter, interactive Baseline editor, and full measurement log + Recharts history.

### Stage 5 — Interactive Frontend Modules (Live Webcam, Mic & Simulators)
- [x] **Vision Monitoring (`/vision`)**:
  - Dual input: **Live Webcam Capture** (`getUserMedia` + alignment reticle guide + snapshot) AND **File Upload / One-Click Demo Sample Loader** (Good vs Altered vs Poor Quality).
  - Side-by-side raw capture vs MediaPipe Landmark Overlay, Image Quality meter, Periorbital & Redness baseline delta gauges, explicit error states, and SANS/ICP scientific disclaimer.
- [x] **Cognitive Monitoring (`/cognitive`)**:
  - Dual input: **Live Microphone WAV Recorder** (real-time canvas waveform + timer + browser PCM->WAV encoding) AND **File Upload / Demo Audio Loader**.
  - Transcript view, 5 acoustic telemetry cards compared to baseline, and **3 interactive controlled cognitive tasks** built right into the UI:
    1. *Reaction Time* (orbital visual stimulus test, 5 trials, millisecond precision)
    2. *Memory Sequence* (telemetry code recall)
    3. *Attention Go/No-Go* (target discrimination test)
- [x] **Health Intelligence (`/intelligence`)**:
  - Trigger `Run Multi-Signal Analysis`, view unified `Green / Yellow / Red` status, signal-by-signal quality badges, missing-data indicators, causal explanation list, and actionable recommendations.
- [x] **Digital Twin (`/digital-twin`)**:
  - Historical + 14-day forecast Recharts visualization with confidence bands and `DEMO / SYNTHETIC` markers.
  - Real-time What-If control deck (`Sleep`, `Activity`, `Nutrition`, `Hydration`, `Workload`) comparing Baseline vs Adjusted scenario + visible "Model Formulas & Assumptions" drawer.

### Stage 6 — End-to-End Integration, Visual Audit & Offline Verification
- [x] Create `./start.sh` to launch FastAPI (`127.0.0.1:8000`) and Next.js (`127.0.0.1:3000`) natively without Docker.
- [x] Execute full **NASA Demo Flow** (`idea.md` §10, steps 14–24) end-to-end and verify SQLite persistence across server restarts.
- [x] Run **Visual & Responsive Audit** in headless Google Chrome at `1440x900` and `390x844` (checking contrast, overflow, tap targets, reduced-motion, no empty states, zero console/API errors).
- [x] Verify offline-first operation (zero external runtime API calls required) and deliver final smoke-test report.

---

## 5. What We Need From You Before Starting Stage 0

1. **Plan Approval:** Confirm you approve `ASTRA_PLAN.md` (or tell me any edits you want).
2. **Tool Installation Approvals:** Because `node`, `npm`, and Python ML packages are not installed yet on this Mac, during Stage 0 I will ask you to approve terminal commands that install `Node.js` (and Python 3.11+ / `pip` packages) outside the sandbox.
3. **Optional Custom Demo Media (or Auto-Generated):**
   - If you already have 2–3 test portrait photos or a short English voice clip (`.wav`/`.mp3`) you want pre-loaded for `AST-001`, share their paths or drop them in `/Users/nurkasymibragim/Desktop/nassa/`.
   - Otherwise, I will automatically prepare clean local demo test samples (and you will also be able to capture directly from your Mac webcam and microphone in the browser!).
4. **Optional Offline Whisper Weights (~75 MB):** Confirm if you'd like me to download the small local `faster-whisper` (`tiny.en`) model once during Stage 0 so voice transcription works 100% offline during your demo.
