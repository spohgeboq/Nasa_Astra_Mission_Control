/**
 * Typed client for ASTRA FastAPI backend (proxied via /api/*).
 */

export type StatusLevel = "Green" | "Yellow" | "Red";

export interface BaselineProfile {
  resting_heart_rate_bpm: number;
  sleep_hours: number;
  sleep_quality_score: number;
  activity_minutes: number;
  hydration_liters: number;
  nutrition_score: number;
  reaction_time_ms: number;
  memory_score: number;
  attention_score: number;
  periorbital_index: number;
  eye_redness_index: number;
  speech_rate_wpm: number;
  pause_duration_sec: number;
  voice_energy_rms: number;
  voice_variability: number;
}

export interface TelemetryPoint {
  id: number;
  astronaut_id: string;
  mission_day: number;
  timestamp: string;
  resting_heart_rate_bpm: number;
  sleep_hours: number;
  sleep_quality_score: number;
  activity_minutes: number;
  hydration_liters: number;
  nutrition_score: number;
  workload_index: number;
  radiation_msv_day: number;
  self_report_mood?: string | null;
  self_report_fatigue?: number | null;
  is_synthetic: boolean;
}

export interface AstronautSummary {
  astronaut_id: string;
  name: string;
  mission_name: string;
  mission_day: number;
  is_synthetic_seed: boolean;
  latest_status: StatusLevel;
  latest_risk_score: number;
  last_assessed?: string | null;
}

export interface AstronautProfile {
  astronaut_id: string;
  name: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  mission_name: string;
  mission_type: string;
  mission_day: number;
  blood_type: string;
  medical_history: string;
  allergies: string;
  medications: string;
  medical_notes: string;
  created_at: string;
  updated_at: string;
  is_synthetic_seed: boolean;
  baseline: BaselineProfile;
  telemetry_history: TelemetryPoint[];
}

export interface VisionAnalysisResponse {
  id?: number;
  astronaut_id: string;
  module: string;
  timestamp: string;
  status: string;
  error_code?: string | null;
  error_detail?: string | null;
  image_quality: number;
  measurements: {
    periorbital_index?: number | null;
    eye_redness_index?: number | null;
    head_yaw_deg?: number | null;
    head_roll_deg?: number | null;
    sharpness_score?: number | null;
    brightness_score?: number | null;
    face_confidence?: number | null;
  };
  baseline_comparison: Record<string, number>;
  anomalies: string[];
  requires_follow_up: boolean;
  source_image_url?: string | null;
  overlay_image_url?: string | null;
  is_synthetic: boolean;
  scientific_disclaimer: string;
}

export interface CognitiveAudioResponse {
  id?: number;
  astronaut_id: string;
  module: string;
  timestamp: string;
  status: string;
  error_code?: string | null;
  error_detail?: string | null;
  data_quality: number;
  transcript: string;
  transcription_engine: string;
  measurements: {
    duration_sec: number;
    speech_rate_wpm?: number | null;
    pause_duration_sec?: number | null;
    pause_ratio?: number | null;
    voice_energy_rms?: number | null;
    voice_variability?: number | null;
    word_repetition_ratio?: number | null;
    snr_db_estimate?: number | null;
  };
  baseline_comparison: Record<string, number>;
  anomalies: string[];
  is_synthetic: boolean;
  scientific_disclaimer: string;
}

export interface CognitiveTestResult {
  id: number;
  astronaut_id: string;
  module: string;
  test_type: "reaction_time" | "memory" | "attention";
  timestamp: string;
  data_quality: number;
  score: number;
  unit: "ms" | "percent";
  accuracy_percent?: number | null;
  baseline_value: number;
  change_percent: number;
  anomaly_detected: boolean;
  is_synthetic: boolean;
}

export interface HealthIntelligenceReport {
  id?: number;
  astronaut_id: string;
  module: string;
  timestamp: string;
  overall_status: StatusLevel;
  risk_score: number;
  data_completeness: number;
  detected_signals: Array<{
    source_module: string;
    signal: string;
    severity: StatusLevel;
    deviation_percent: number;
    summary: string;
  }>;
  missing_signals: string[];
  signal_qualities: Array<{
    signal_name: string;
    available: boolean;
    quality_score: number;
    timestamp?: string | null;
    is_synthetic: boolean;
    note: string;
  }>;
  explanation: string;
  recommended_next_steps: string[];
  requires_human_review: boolean;
  thresholds_disclaimer: string;
}

export interface ForecastPoint {
  day_offset: number;
  mission_day: number;
  label: string;
  is_forecast: boolean;
  is_synthetic: boolean;
  cognitive_readiness: number;
  fatigue_index: number;
  recovery_score: number;
  uncertainty_band: number;
}

export interface DigitalTwinForecast {
  astronaut_id: string;
  module: string;
  timestamp: string;
  current_mission_day: number;
  baseline_readiness: number;
  history_and_forecast: ForecastPoint[];
  model_assumptions: string[];
  disclaimer: string;
}

export interface WhatIfPayload {
  astronaut_id: string;
  sleep_hours: number;
  exercise_minutes: number;
  nutrition_score: number;
  hydration_liters: number;
  workload_index: number;
}

export interface WhatIfScenarioResponse {
  astronaut_id: string;
  module: string;
  timestamp: string;
  inputs: WhatIfPayload;
  baseline_scenario: ForecastPoint[];
  adjusted_scenario: ForecastPoint[];
  day_14_delta: {
    cognitive_readiness_delta: number;
    fatigue_index_delta: number;
    recovery_score_delta: number;
  };
  explanation: string;
  formulas_used: string[];
  disclaimer: string;
}

export interface SystemStatusResponse {
  mode: string;
  database_path: string;
  mediapipe_model_ready: boolean;
  whisper_offline_ready: boolean;
  offline_sync_queued_count: number;
  recent_sync_queue: Array<{
    id: number;
    astronaut_id: string;
    module: string;
    payload_summary: string;
    status: string;
    created_at: string;
  }>;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const err = await res.json();
      msg = err.detail || msg;
    } catch {
      // keep status message
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const astraApi = {
  getSystemStatus: () => apiFetch<SystemStatusResponse>("/api/system/status"),
  listAstronauts: () => apiFetch<AstronautSummary[]>("/api/astronauts"),
  getAstronaut: (id: string) => apiFetch<AstronautProfile>(`/api/astronauts/${id}`),
  createAstronaut: (payload: Record<string, unknown>) =>
    apiFetch<AstronautProfile>("/api/astronauts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateBaseline: (id: string, payload: BaselineProfile) =>
    apiFetch<AstronautProfile>(`/api/astronauts/${id}/baseline`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addTelemetry: (id: string, payload: Record<string, unknown>) =>
    apiFetch<TelemetryPoint>(`/api/astronauts/${id}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  analyzeVisionFile: (astronautId: string, file: Blob, filename: string) => {
    const fd = new FormData();
    fd.append("astronaut_id", astronautId);
    fd.append("is_synthetic", "false");
    fd.append("file", file, filename);
    return apiFetch<VisionAnalysisResponse>("/api/vision/analyze", {
      method: "POST",
      body: fd,
    });
  },
  analyzeVisionDemo: (astronautId: string, sample: "baseline" | "followup" | "poor") =>
    apiFetch<VisionAnalysisResponse>(
      `/api/vision/analyze-demo?astronaut_id=${encodeURIComponent(astronautId)}&sample=${sample}`,
      { method: "POST" }
    ),
  getVisionHistory: (astronautId: string) =>
    apiFetch<VisionAnalysisResponse[]>(`/api/vision/${astronautId}/history`),
  analyzeCognitiveAudioFile: (astronautId: string, file: Blob, filename: string) => {
    const fd = new FormData();
    fd.append("astronaut_id", astronautId);
    fd.append("is_synthetic", "false");
    fd.append("file", file, filename);
    return apiFetch<CognitiveAudioResponse>("/api/cognitive/analyze", {
      method: "POST",
      body: fd,
    });
  },
  analyzeCognitiveDemo: (astronautId: string, sample: "clean" | "noisy") =>
    apiFetch<CognitiveAudioResponse>(
      `/api/cognitive/analyze-demo?astronaut_id=${encodeURIComponent(astronautId)}&sample=${sample}`,
      { method: "POST" }
    ),
  submitCognitiveTest: (payload: {
    astronaut_id: string;
    test_type: "reaction_time" | "memory" | "attention";
    score: number;
    unit: "ms" | "percent";
    trials_count: number;
    accuracy_percent?: number;
  }) =>
    apiFetch<CognitiveTestResult>("/api/cognitive/test-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getCognitiveHistory: (astronautId: string) =>
    apiFetch<{ audio_analyses: CognitiveAudioResponse[]; test_results: CognitiveTestResult[] }>(
      `/api/cognitive/${astronautId}/history`
    ),
  runHealthIntelligence: (astronautId: string, selfReportNote?: string) =>
    apiFetch<HealthIntelligenceReport>("/api/intelligence/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        astronaut_id: astronautId,
        include_self_report_note: selfReportNote || null,
      }),
    }),
  getLatestIntelligence: (astronautId: string) =>
    apiFetch<HealthIntelligenceReport>(`/api/intelligence/${astronautId}/latest`),
  getDigitalTwinForecast: (astronautId: string) =>
    apiFetch<DigitalTwinForecast>(`/api/digital-twin/${astronautId}/forecast`),
  simulateWhatIf: (payload: WhatIfPayload) =>
    apiFetch<WhatIfScenarioResponse>("/api/digital-twin/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
