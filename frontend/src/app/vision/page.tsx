"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, Eye, UploadSimple, Warning } from "@phosphor-icons/react";
import { astraApi, VisionAnalysisResponse } from "@/lib/api";
import { useAstra } from "@/components/AstraContext";
import {
  ButtonInButton,
  DisclaimerBanner,
  DoubleBezelCard,
  EyebrowTag,
  SyntheticBadge,
} from "@/components/DoubleBezel";

export default function VisionPage() {
  const { astronautId, refreshGlobal } = useAstra();
  const [result, setResult] = useState<VisionAnalysisResponse | null>(null);
  const [history, setHistory] = useState<VisionAnalysisResponse[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Webcam state
  const [camActive, setCamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const h = await astraApi.getVisionHistory(astronautId);
      setHistory(h);
      if (h.length > 0 && !result) {
        setResult(h[0]);
      }
    } catch {
      // handled
    }
  }, [astronautId, result]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  async function startCamera() {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCamActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Camera access denied or unavailable: ${err.message}`
          : "Camera unavailable."
      );
    }
  }

  async function captureAndAnalyze() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setBusy(true);
    setErrorMsg(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Failed to capture frame from webcam.");
      const res = await astraApi.analyzeVisionFile(astronautId, blob, "webcam_capture.png");
      setResult(res);
      await loadHistory();
      await refreshGlobal();
      stopCamera();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Vision analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await astraApi.analyzeVisionFile(astronautId, file, file.name);
      setResult(res);
      await loadHistory();
      await refreshGlobal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Vision upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function runDemo(sample: "baseline" | "followup" | "poor") {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await astraApi.analyzeVisionDemo(astronautId, sample);
      setResult(res);
      await loadHistory();
      await refreshGlobal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Demo sample failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 animate-orbital-enter">
      <div>
        <EyebrowTag>MODULE 2 · VISION MONITORING (OPENCV + MEDIAPIPE FACE MESH)</EyebrowTag>
        <h1 className="mt-2 text-3xl font-semibold text-[#F1F5F9]">
          Facial &amp; Periorbital Baseline Screening
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[#94A3B8]">
          Capture a standardized frontal portrait via live cabin webcam or upload an image. MediaPipe
          extracts 468 facial landmarks, verifies image quality &amp; head alignment, and computes
          relative periorbital and eye-area shifts against the astronaut&apos;s personal baseline.
        </p>
      </div>

      <DisclaimerBanner text="Scientific Limitation: A standard RGB camera does NOT measure intracranial pressure (ICP), diagnose Spaceflight-Associated Neuro-ocular Syndrome (SANS), or replace clinical OCT exams. Outputs represent relative screening signals requiring human follow-up." />

      {errorMsg && (
        <div className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#FCA5A5]">
          {errorMsg}
        </div>
      )}

      {/* Dual Input Deck + Visual Proof */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Capture & Upload Controls */}
        <DoubleBezelCard className="lg:col-span-5">
          <h2 className="text-lg font-semibold text-[#F1F5F9] mb-4">
            Capture or Upload Facial Scan
          </h2>

          {/* Live Webcam Box */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D131F] aspect-[4/3] mb-4 flex items-center justify-center">
            {camActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover scale-x-[-1]"
                />
                {/* Orbital alignment reticle overlay */}
                <svg
                  viewBox="0 0 400 300"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  <ellipse
                    cx="200"
                    cy="145"
                    rx="72"
                    ry="96"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    strokeDasharray="6 6"
                  />
                  <line x1="145" y1="125" x2="255" y2="125" stroke="#00E5FF" strokeWidth="0.9" strokeOpacity="0.6" />
                  <text
                    x="200"
                    y="272"
                    textAnchor="middle"
                    fill="#38BDF8"
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    ALIGN FACE INSIDE ORBITAL RETICLE · EVEN LIGHTING
                  </text>
                </svg>
              </>
            ) : (
              <div className="text-center p-6 space-y-2">
                <Camera size={36} weight="light" className="mx-auto text-[#38BDF8]" />
                <div className="text-sm font-medium text-[#F1F5F9]">Live Webcam Scanner</div>
                <div className="text-xs text-[#94A3B8]">
                  Uses browser MediaDevices directly on-device
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5 mb-5">
            {!camActive ? (
              <ButtonInButton onClick={startCamera} disabled={busy}>
                Activate Live Webcam
              </ButtonInButton>
            ) : (
              <>
                <ButtonInButton onClick={captureAndAnalyze} disabled={busy}>
                  {busy ? "Analyzing..." : "Capture & Scan Frame"}
                </ButtonInButton>
                <ButtonInButton variant="secondary" onClick={stopCamera}>
                  Stop Camera
                </ButtonInButton>
              </>
            )}

            <label className="group inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/[0.06] px-5 py-2 text-sm font-medium text-[#F1F5F9] ring-1 ring-white/15 hover:bg-white/[0.11] cursor-pointer orbital-transition">
              <UploadSimple size={16} weight="light" className="text-[#38BDF8]" />
              <span>Upload JPG / PNG</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Demo Sample Buttons */}
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-mono-num uppercase tracking-wider text-[#94A3B8]">
                Standardized Demo Samples
              </span>
              <SyntheticBadge />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => runDemo("baseline")}
                className="min-h-[44px] rounded-xl border border-white/10 bg-[#0D131F] px-3 py-2 text-xs text-[#CBD5E1] hover:border-[#38BDF8]/50 cursor-pointer orbital-transition"
              >
                1. Baseline Clean
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runDemo("followup")}
                className="min-h-[44px] rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#FBBF24] hover:bg-[#F59E0B]/20 cursor-pointer orbital-transition"
              >
                2. Day 30 Follow-Up
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runDemo("poor")}
                className="min-h-[44px] rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#FCA5A5] hover:bg-[#EF4444]/20 cursor-pointer orbital-transition"
              >
                3. Poor / Blurry Test
              </button>
            </div>
          </div>
        </DoubleBezelCard>

        {/* Right: Landmark Overlay & Baseline Deltas */}
        <DoubleBezelCard className="lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Eye size={20} weight="light" className="text-[#38BDF8]" />
              <h2 className="text-lg font-semibold text-[#F1F5F9]">
                MediaPipe Landmark Alignment &amp; Metrics
              </h2>
            </div>
            {result?.is_synthetic && <SyntheticBadge />}
          </div>

          {!result ? (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-[#94A3B8]">
              Capture a webcam frame, upload a portrait, or run a standardized demo sample.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Quality / Rejection Status */}
              {result.status !== "ok" ? (
                <div className="flex items-start gap-3 rounded-2xl border border-[#EF4444]/35 bg-[#EF4444]/10 p-4 text-sm text-[#FCA5A5]">
                  <Warning size={20} weight="light" className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono-num uppercase text-xs font-semibold">
                      QUALITY GATE REJECTION: {result.error_code}
                    </div>
                    <p className="mt-1 text-xs text-[#FECACA]">{result.error_detail}</p>
                  </div>
                </div>
              ) : (
                <div
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
                    result.requires_follow_up
                      ? "border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#FDE68A]"
                      : "border-[#10B981]/35 bg-[#10B981]/10 text-[#A7F3D0]"
                  }`}
                >
                  {result.requires_follow_up ? (
                    <Warning size={20} weight="light" className="shrink-0 mt-0.5 text-[#F59E0B]" />
                  ) : (
                    <CheckCircle size={20} weight="light" className="shrink-0 mt-0.5 text-[#10B981]" />
                  )}
                  <div>
                    <div className="font-mono-num uppercase text-xs font-semibold">
                      {result.requires_follow_up
                        ? "VISUAL CHANGE SIGNAL — REQUIRES FOLLOW-UP"
                        : "NOMINAL — WITHIN BASELINE TOLERANCE"}
                    </div>
                    <div className="mt-1 text-xs opacity-90">
                      Anomalies:{" "}
                      {result.anomalies.length > 0 ? result.anomalies.join(", ") : "None detected"}
                    </div>
                  </div>
                </div>
              )}

              {/* Image Preview Side-by-Side */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#0D131F] p-2">
                  <div className="px-2 py-1 text-[10px] font-mono-num uppercase tracking-wider text-[#94A3B8]">
                    Source Frame
                  </div>
                  {result.source_image_url && (
                    <img
                      src={result.source_image_url}
                      alt="Source facial capture"
                      className="mt-1 w-full rounded-xl object-cover aspect-[4/3]"
                    />
                  )}
                </div>
                <div className="rounded-2xl border border-[#38BDF8]/25 bg-[#0D131F] p-2">
                  <div className="px-2 py-1 text-[10px] font-mono-num uppercase tracking-wider text-[#38BDF8]">
                    468-Landmark &amp; Periorbital ROI Overlay
                  </div>
                  {result.overlay_image_url && (
                    <img
                      src={result.overlay_image_url}
                      alt="MediaPipe facial landmark overlay"
                      className="mt-1 w-full rounded-xl object-cover aspect-[4/3]"
                    />
                  )}
                </div>
              </div>

              {/* Numeric Telemetry Readouts */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Image Quality</div>
                  <div className="mt-1 text-lg font-mono-num font-semibold text-[#38BDF8]">
                    {Math.round(result.image_quality * 100)}%
                  </div>
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Periorbital Index</div>
                  <div className="mt-1 text-lg font-mono-num font-semibold text-[#F1F5F9]">
                    {result.measurements.periorbital_index ?? "—"}
                  </div>
                  {result.baseline_comparison.periorbital_change_percent !== undefined && (
                    <div className="text-[11px] font-mono-num text-[#FBBF24]">
                      {result.baseline_comparison.periorbital_change_percent >= 0 ? "+" : ""}
                      {result.baseline_comparison.periorbital_change_percent}% vs base
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Eye Redness</div>
                  <div className="mt-1 text-lg font-mono-num font-semibold text-[#F1F5F9]">
                    {result.measurements.eye_redness_index ?? "—"}
                  </div>
                  {result.baseline_comparison.eye_redness_change_percent !== undefined && (
                    <div className="text-[11px] font-mono-num text-[#FBBF24]">
                      {result.baseline_comparison.eye_redness_change_percent >= 0 ? "+" : ""}
                      {result.baseline_comparison.eye_redness_change_percent}% vs base
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Head Pose (Yaw/Roll)</div>
                  <div className="mt-1 text-sm font-mono-num font-semibold text-[#F1F5F9]">
                    {result.measurements.head_yaw_deg ?? "—"}° / {result.measurements.head_roll_deg ?? "—"}°
                  </div>
                  <div className="text-[11px] font-mono-num text-[#94A3B8]">
                    Sharpness: {result.measurements.sharpness_score ?? "—"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DoubleBezelCard>
      </div>

      {/* Scan History */}
      {history.length > 0 && (
        <DoubleBezelCard>
          <h2 className="text-base font-semibold text-[#F1F5F9] mb-3">
            Recent Vision Scans ({astronautId})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {history.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setResult(item)}
                className="text-left rounded-xl border border-white/10 bg-[#0D131F] p-3 hover:border-[#38BDF8]/45 cursor-pointer orbital-transition"
              >
                <div className="flex items-center justify-between text-[11px] font-mono-num">
                  <span className={item.status === "ok" ? "text-[#34D399]" : "text-[#F87171]"}>
                    {item.status.toUpperCase()}
                  </span>
                  <span className="text-[#94A3B8]">Q:{Math.round(item.image_quality * 100)}%</span>
                </div>
                <div className="mt-1.5 text-xs text-[#CBD5E1] font-mono-num">
                  Peri: {item.measurements.periorbital_index ?? "N/A"} · Red:{" "}
                  {item.measurements.eye_redness_index ?? "N/A"}
                </div>
              </button>
            ))}
          </div>
        </DoubleBezelCard>
      )}
    </div>
  );
}
