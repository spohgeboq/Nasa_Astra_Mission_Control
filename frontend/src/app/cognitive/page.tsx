"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Brain,
  CheckCircle,
  Microphone,
  StopCircle,
  Timer,
  UploadSimple,
  Warning,
} from "@phosphor-icons/react";
import { astraApi, CognitiveAudioResponse, CognitiveTestResult } from "@/lib/api";
import { encodeWavBlob } from "@/lib/wav-encoder";
import { useAstra } from "@/components/AstraContext";
import {
  ButtonInButton,
  DisclaimerBanner,
  DoubleBezelCard,
  EyebrowTag,
  SyntheticBadge,
} from "@/components/DoubleBezel";

type ActiveTask = "reaction" | "memory" | "attention";

export default function CognitivePage() {
  const { astronautId, refreshGlobal } = useAstra();
  const [audioRes, setAudioRes] = useState<CognitiveAudioResponse | null>(null);
  const [testHistory, setTestHistory] = useState<CognitiveTestResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);

  // Live Mic Recorder state (PCM -> 16kHz WAV directly in browser)
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Controlled Cognitive Tasks state
  const [activeTask, setActiveTask] = useState<ActiveTask>("reaction");

  // 1. Reaction Time (5 trials)
  const [rtPhase, setRtPhase] = useState<"idle" | "waiting" | "ready" | "done">("idle");
  const [rtTrials, setRtTrials] = useState<number[]>([]);
  const [rtMessage, setRtMessage] = useState("Run 5 visual stimulus trials to measure true reaction latency.");
  const rtStartRef = useRef<number>(0);
  const rtTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2. Memory Sequence
  const [memStage, setMemStage] = useState<"idle" | "memorize" | "recall" | "done">("idle");
  const [memSequence, setMemSequence] = useState<string[]>([]);
  const [memInput, setMemInput] = useState("");
  const [memScore, setMemScore] = useState<number | null>(null);

  // 3. Attention Go/No-Go (10 trials)
  const [attStage, setAttStage] = useState<"idle" | "running" | "done">("idle");
  const [attTrialIdx, setAttTrialIdx] = useState(0);
  const [attStimulus, setAttStimulus] = useState<"TARGET" | "DECOY" | null>(null);
  const attStatsRef = useRef({ hits: 0, totalTargets: 0, falseAlarms: 0, responded: false });
  const attIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const h = await astraApi.getCognitiveHistory(astronautId);
      setTestHistory(h.test_results || []);
      if (h.audio_analyses.length > 0 && !audioRes) {
        setAudioRes(h.audio_analyses[0]);
      }
    } catch {
      // handled
    }
  }, [astronautId, audioRes]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const cleanupMic = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (processorRef.current) processorRef.current.disconnect();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    setRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      cleanupMic();
      if (rtTimeoutRef.current) clearTimeout(rtTimeoutRef.current);
      if (attIntervalRef.current) clearTimeout(attIntervalRef.current);
    };
  }, [cleanupMic]);

  async function startRecording() {
    setErrorMsg(null);
    chunksRef.current = [];
    setRecSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
        // Draw live waveform onto canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const g = canvas.getContext("2d");
          if (g) {
            g.fillStyle = "#0D131F";
            g.fillRect(0, 0, canvas.width, canvas.height);
            g.strokeStyle = "#38BDF8";
            g.lineWidth = 1.8;
            g.beginPath();
            const step = Math.max(1, Math.floor(input.length / canvas.width));
            for (let x = 0; x < canvas.width; x++) {
              const sample = input[x * step] || 0;
              const y = canvas.height / 2 + sample * (canvas.height * 0.42);
              if (x === 0) g.moveTo(x, y);
              else g.lineTo(x, y);
            }
            g.stroke();
          }
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setRecSeconds((s) => Number((s + 0.1).toFixed(1)));
      }, 100);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Microphone unavailable: ${err.message}`
          : "Microphone access denied."
      );
    }
  }

  async function stopAndAnalyzeMic() {
    const sampleRate = audioCtxRef.current?.sampleRate || 44100;
    const chunks = [...chunksRef.current];
    cleanupMic();
    if (chunks.length === 0) return;

    const wavBlob = encodeWavBlob(chunks, sampleRate);
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await astraApi.analyzeCognitiveAudioFile(
        astronautId,
        wavBlob,
        "mic_checkin.wav"
      );
      setAudioRes(res);
      await loadHistory();
      await refreshGlobal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Microphone analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await astraApi.analyzeCognitiveAudioFile(astronautId, file, file.name);
      setAudioRes(res);
      await loadHistory();
      await refreshGlobal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Audio upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function runDemoAudio(sample: "clean" | "noisy") {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await astraApi.analyzeCognitiveDemo(astronautId, sample);
      setAudioRes(res);
      await loadHistory();
      await refreshGlobal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Demo audio failed.");
    } finally {
      setBusy(false);
    }
  }

  // --- Controlled Task 1: Reaction Time ---
  function startReactionTrial(existingTrials: number[] = []) {
    setTaskMsg(null);
    setRtPhase("waiting");
    setRtMessage(`Trial ${existingTrials.length + 1}/5: Wait for CYAN LOCK signal...`);
    const delay = 1100 + Math.random() * 1900;
    rtTimeoutRef.current = setTimeout(() => {
      rtStartRef.current = performance.now();
      setRtPhase("ready");
      setRtMessage("ENGAGE TARGET NOW!");
    }, delay);
  }

  async function handleReactionPadClick() {
    if (rtPhase === "waiting") {
      if (rtTimeoutRef.current) clearTimeout(rtTimeoutRef.current);
      setRtMessage("False start! Wait until signal turns cyan. Retrying trial...");
      setTimeout(() => startReactionTrial(rtTrials), 800);
      return;
    }
    if (rtPhase === "ready") {
      const elapsed = Math.round(performance.now() - rtStartRef.current);
      const nextTrials = [...rtTrials, elapsed];
      setRtTrials(nextTrials);
      if (nextTrials.length < 5) {
        startReactionTrial(nextTrials);
      } else {
        setRtPhase("done");
        const meanMs = Math.round(nextTrials.reduce((a, b) => a + b, 0) / nextTrials.length);
        setRtMessage(`Completed 5 trials · Mean Reaction Latency: ${meanMs} ms`);
        try {
          const saved = await astraApi.submitCognitiveTest({
            astronaut_id: astronautId,
            test_type: "reaction_time",
            score: meanMs,
            unit: "ms",
            trials_count: 5,
            accuracy_percent: 100,
          });
          setTaskMsg(`Saved Reaction Time (${saved.score} ms, ${saved.change_percent >= 0 ? "+" : ""}${saved.change_percent}% vs baseline).`);
          await loadHistory();
          await refreshGlobal();
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to save reaction test.");
        }
      }
    }
  }

  // --- Controlled Task 2: Memory Sequence ---
  function startMemoryTask() {
    const tokens = ["K7", "R2", "M9", "A4", "X1", "V6", "T3", "N8"];
    const picked: string[] = [];
    for (let i = 0; i < 5; i++) {
      picked.push(tokens[Math.floor(Math.random() * tokens.length)]);
    }
    setMemSequence(picked);
    setMemInput("");
    setMemScore(null);
    setTaskMsg(null);
    setMemStage("memorize");
    setTimeout(() => {
      setMemStage("recall");
    }, 3500);
  }

  async function submitMemoryRecall(e: React.FormEvent) {
    e.preventDefault();
    const entered = memInput
      .toUpperCase()
      .split(/[\s,\-]+/)
      .filter(Boolean);
    let matches = 0;
    for (let i = 0; i < memSequence.length; i++) {
      if (entered[i] === memSequence[i]) matches++;
    }
    const pct = Math.round((matches / memSequence.length) * 100);
    setMemScore(pct);
    setMemStage("done");
    try {
      const saved = await astraApi.submitCognitiveTest({
        astronaut_id: astronautId,
        test_type: "memory",
        score: pct,
        unit: "percent",
        trials_count: memSequence.length,
        accuracy_percent: pct,
      });
      setTaskMsg(`Saved Memory Recall (${saved.score}%, ${saved.change_percent >= 0 ? "+" : ""}${saved.change_percent}% vs baseline).`);
      await loadHistory();
      await refreshGlobal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save memory test.");
    }
  }

  // --- Controlled Task 3: Attention Go/No-Go ---
  function runNextAttentionStep(stepIndex: number) {
    if (stepIndex >= 10) {
      setAttStage("done");
      setAttStimulus(null);
      const { hits, totalTargets, falseAlarms } = attStatsRef.current;
      const rawAcc =
        totalTargets > 0
          ? Math.max(0, Math.round(((hits - falseAlarms * 0.5) / totalTargets) * 100))
          : 100;
      astraApi
        .submitCognitiveTest({
          astronaut_id: astronautId,
          test_type: "attention",
          score: rawAcc,
          unit: "percent",
          trials_count: 10,
          accuracy_percent: rawAcc,
        })
        .then((saved) => {
          setTaskMsg(`Saved Attention Vigilance (${saved.score}%, ${saved.change_percent >= 0 ? "+" : ""}${saved.change_percent}% vs baseline).`);
          loadHistory();
          refreshGlobal();
        })
        .catch(() => {});
      return;
    }

    const isTarget = Math.random() < 0.65;
    if (isTarget) attStatsRef.current.totalTargets += 1;
    attStatsRef.current.responded = false;
    setAttTrialIdx(stepIndex + 1);
    setAttStimulus(isTarget ? "TARGET" : "DECOY");

    attIntervalRef.current = setTimeout(() => {
      setAttStimulus(null);
      attIntervalRef.current = setTimeout(() => {
        runNextAttentionStep(stepIndex + 1);
      }, 320);
    }, 950);
  }

  function startAttentionTask() {
    setTaskMsg(null);
    attStatsRef.current = { hits: 0, totalTargets: 0, falseAlarms: 0, responded: false };
    setAttStage("running");
    runNextAttentionStep(0);
  }

  function handleAttentionTap() {
    if (attStage !== "running" || !attStimulus || attStatsRef.current.responded) return;
    attStatsRef.current.responded = true;
    if (attStimulus === "TARGET") {
      attStatsRef.current.hits += 1;
    } else {
      attStatsRef.current.falseAlarms += 1;
    }
  }

  return (
    <div className="space-y-8 animate-orbital-enter">
      <div>
        <EyebrowTag>MODULE 3 · COGNITIVE MONITORING (LIBROSA + WHISPER + CONTROLLED TASKS)</EyebrowTag>
        <h1 className="mt-2 text-3xl font-semibold text-[#F1F5F9]">
          Voice Acoustics &amp; Controlled Cognitive Tasks
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[#94A3B8]">
          Record speech directly via onboard microphone (encoded natively to 16kHz WAV in browser) or
          upload audio for local Whisper transcription and Librosa acoustic analysis, paired with
          controlled reaction, memory, and vigilance tasks.
        </p>
      </div>

      <DisclaimerBanner text="Methodological Guardrail: Reaction latency cannot be reliably inferred from arbitrary speech audio—it is measured via controlled stimulus-response tasks below. Voice metrics track fatigue/load shifts vs baseline and do NOT diagnose depression or psychiatric disorders." />

      {errorMsg && (
        <div className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#FCA5A5]">
          {errorMsg}
        </div>
      )}

      {/* Audio Studio Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Mic Recorder & Upload */}
        <DoubleBezelCard className="lg:col-span-5">
          <h2 className="text-lg font-semibold text-[#F1F5F9] mb-4">
            Crew Voice Check-In Studio
          </h2>

          <div className="rounded-2xl border border-white/10 bg-[#0D131F] p-4 mb-4">
            <div className="flex items-center justify-between text-xs font-mono-num text-[#94A3B8] mb-2">
              <span>{recording ? "RECORDING LIVE PCM -> WAV" : "MICROPHONE WAVEFORM READY"}</span>
              <span className={recording ? "text-[#EF4444]" : "text-[#38BDF8]"}>
                {recSeconds.toFixed(1)}s
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={420}
              height={96}
              className="w-full h-24 rounded-xl bg-[#0D131F]"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 mb-5">
            {!recording ? (
              <ButtonInButton onClick={startRecording} disabled={busy}>
                <span className="inline-flex items-center gap-2">
                  <Microphone size={16} weight="light" />
                  Record Voice Check-In
                </span>
              </ButtonInButton>
            ) : (
              <ButtonInButton onClick={stopAndAnalyzeMic}>
                <span className="inline-flex items-center gap-2">
                  <StopCircle size={16} weight="light" />
                  Stop &amp; Analyze WAV
                </span>
              </ButtonInButton>
            )}

            <label className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/[0.06] px-5 py-2 text-sm font-medium text-[#F1F5F9] ring-1 ring-white/15 hover:bg-white/[0.11] cursor-pointer orbital-transition">
              <UploadSimple size={16} weight="light" className="text-[#38BDF8]" />
              <span>Upload WAV / MP3</span>
              <input
                type="file"
                accept=".wav,.mp3,.ogg,audio/*"
                onChange={handleAudioUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-mono-num uppercase tracking-wider text-[#94A3B8]">
                Demo Audio Clips
              </span>
              <SyntheticBadge />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => runDemoAudio("clean")}
                className="min-h-[44px] rounded-xl border border-white/10 bg-[#0D131F] px-3 py-2 text-xs text-[#CBD5E1] hover:border-[#38BDF8]/50 cursor-pointer orbital-transition"
              >
                1. Clean Mission Log
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runDemoAudio("noisy")}
                className="min-h-[44px] rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#FCA5A5] hover:bg-[#EF4444]/20 cursor-pointer orbital-transition"
              >
                2. Noisy / Clipped Test
              </button>
            </div>
          </div>
        </DoubleBezelCard>

        {/* Right: Transcript + Acoustic Metrics */}
        <DoubleBezelCard className="lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Brain size={20} weight="light" className="text-[#38BDF8]" />
              <h2 className="text-lg font-semibold text-[#F1F5F9]">
                Speech Transcript &amp; Acoustic Biomarkers
              </h2>
            </div>
            {audioRes?.is_synthetic && <SyntheticBadge />}
          </div>

          {!audioRes ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-[#94A3B8]">
              Record a live voice check-in or run a demo audio sample.
            </div>
          ) : (
            <div className="space-y-4">
              {audioRes.status !== "ok" ? (
                <div className="flex items-start gap-3 rounded-2xl border border-[#EF4444]/35 bg-[#EF4444]/10 p-4 text-xs text-[#FCA5A5]">
                  <Warning size={18} weight="light" className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono-num uppercase font-semibold">
                      AUDIO REJECTED: {audioRes.error_code}
                    </div>
                    <p className="mt-1">{audioRes.error_detail}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#0D131F] p-4">
                  <div className="flex flex-wrap justify-between gap-2 text-[11px] font-mono-num text-[#38BDF8] mb-2">
                    <span>ENGINE: {audioRes.transcription_engine}</span>
                    <span>
                      QUALITY: {Math.round(audioRes.data_quality * 100)}% · SNR:{" "}
                      {audioRes.measurements.snr_db_estimate} dB
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-[#F1F5F9]">
                    &ldquo;{audioRes.transcript}&rdquo;
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Speech Rate</div>
                  <div className="mt-1 text-lg font-mono-num font-semibold text-[#F1F5F9]">
                    {audioRes.measurements.speech_rate_wpm ?? "—"} <span className="text-xs">WPM</span>
                  </div>
                  {audioRes.baseline_comparison.speech_rate_change_percent !== undefined && (
                    <div className="text-[11px] font-mono-num text-[#38BDF8]">
                      {audioRes.baseline_comparison.speech_rate_change_percent >= 0 ? "+" : ""}
                      {audioRes.baseline_comparison.speech_rate_change_percent}% vs base
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Mean Pause</div>
                  <div className="mt-1 text-lg font-mono-num font-semibold text-[#F1F5F9]">
                    {audioRes.measurements.pause_duration_sec ?? "—"} <span className="text-xs">sec</span>
                  </div>
                  {audioRes.baseline_comparison.pause_duration_change_percent !== undefined && (
                    <div className="text-[11px] font-mono-num text-[#FBBF24]">
                      {audioRes.baseline_comparison.pause_duration_change_percent >= 0 ? "+" : ""}
                      {audioRes.baseline_comparison.pause_duration_change_percent}% vs base
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Pitch Variability</div>
                  <div className="mt-1 text-lg font-mono-num font-semibold text-[#F1F5F9]">
                    {audioRes.measurements.voice_variability ?? "—"} <span className="text-xs">Hz</span>
                  </div>
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Voice Energy (RMS)</div>
                  <div className="mt-1 text-lg font-mono-num font-semibold text-[#F1F5F9]">
                    {audioRes.measurements.voice_energy_rms ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Word Repetition</div>
                  <div className="mt-1 text-lg font-mono-num font-semibold text-[#F1F5F9]">
                    {audioRes.measurements.word_repetition_ratio ?? "—"}%
                  </div>
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Anomalies</div>
                  <div className="mt-1 text-xs font-mono-num text-[#FBBF24]">
                    {audioRes.anomalies.length > 0 ? audioRes.anomalies.join(", ") : "Nominal"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DoubleBezelCard>
      </div>

      {/* Controlled Cognitive Tasks Suite */}
      <DoubleBezelCard>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <EyebrowTag>CONTROLLED COGNITIVE BATTERY</EyebrowTag>
            <h2 className="mt-2 text-xl font-semibold text-[#F1F5F9]">
              Interactive Stimulus-Response Assessments
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: "reaction", label: "1. Reaction Time" },
              { id: "memory", label: "2. Memory Recall" },
              { id: "attention", label: "3. Attention Go/No-Go" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTask(tab.id as ActiveTask)}
                className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-medium orbital-transition cursor-pointer ${
                  activeTask === tab.id
                    ? "bg-[#38BDF8] text-[#04060A]"
                    : "bg-white/[0.06] text-[#CBD5E1] hover:bg-white/[0.11]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {taskMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#10B981]/35 bg-[#10B981]/10 px-4 py-3 text-sm text-[#A7F3D0]">
            <CheckCircle size={18} weight="light" />
            <span>{taskMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#0D131F] p-6">
            {activeTask === "reaction" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono-num text-[#94A3B8]">
                  <span className="inline-flex items-center gap-1.5">
                    <Timer size={16} weight="light" className="text-[#38BDF8]" />
                    REACTION LATENCY TASK (5 TRIALS)
                  </span>
                  <span>TRIALS: {rtTrials.length}/5</span>
                </div>
                <button
                  type="button"
                  onClick={
                    rtPhase === "idle" || rtPhase === "done"
                      ? () => {
                          setRtTrials([]);
                          startReactionTrial([]);
                        }
                      : handleReactionPadClick
                  }
                  className={`flex h-44 w-full flex-col items-center justify-center rounded-2xl border text-center orbital-transition cursor-pointer ${
                    rtPhase === "ready"
                      ? "border-[#00E5FF] bg-[#38BDF8]/25 text-[#F1F5F9]"
                      : rtPhase === "waiting"
                      ? "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FDE68A]"
                      : "border-white/15 bg-white/[0.03] text-[#CBD5E1] hover:border-[#38BDF8]/50"
                  }`}
                >
                  <div className="text-lg font-semibold">
                    {rtPhase === "idle"
                      ? "Click to Start Reaction Test"
                      : rtPhase === "done"
                      ? "Click to Re-Run Reaction Test"
                      : rtMessage}
                  </div>
                  {rtTrials.length > 0 && (
                    <div className="mt-2 text-xs font-mono-num text-[#38BDF8]">
                      Trials (ms): {rtTrials.join(" · ")}
                    </div>
                  )}
                </button>
              </div>
            )}

            {activeTask === "memory" && (
              <div className="space-y-4">
                <div className="text-xs font-mono-num text-[#94A3B8]">
                  ORBITAL TELEMETRY MEMORY RECALL (5 TOKENS)
                </div>
                {memStage === "idle" && (
                  <ButtonInButton onClick={startMemoryTask}>
                    Display 5-Token Sequence (3.5s)
                  </ButtonInButton>
                )}
                {memStage === "memorize" && (
                  <div className="rounded-2xl border border-[#38BDF8]/40 bg-[#38BDF8]/10 p-6 text-center">
                    <div className="text-xs font-mono-num text-[#38BDF8] mb-2">MEMORIZE SEQUENCE</div>
                    <div className="text-3xl font-mono-num font-bold tracking-[0.25em] text-[#F1F5F9]">
                      {memSequence.join(" ")}
                    </div>
                  </div>
                )}
                {memStage === "recall" && (
                  <form onSubmit={submitMemoryRecall} className="space-y-3">
                    <label className="block text-xs text-[#94A3B8]">
                      Enter the 5 tokens separated by spaces (e.g. K7 R2 M9 A4 X1):
                      <input
                        type="text"
                        autoFocus
                        value={memInput}
                        onChange={(e) => setMemInput(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-white/15 bg-[#080C14] px-4 py-3 text-base font-mono-num uppercase text-[#F1F5F9]"
                      />
                    </label>
                    <ButtonInButton type="submit">Submit Memory Recall</ButtonInButton>
                  </form>
                )}
                {memStage === "done" && (
                  <div className="space-y-3">
                    <div className="text-lg font-semibold text-[#F1F5F9]">
                      Recall Accuracy: <span className="font-mono-num text-[#38BDF8]">{memScore}%</span>
                    </div>
                    <div className="text-xs font-mono-num text-[#94A3B8]">
                      Target Sequence: {memSequence.join(" ")}
                    </div>
                    <ButtonInButton onClick={startMemoryTask}>Run New Sequence</ButtonInButton>
                  </div>
                )}
              </div>
            )}

            {activeTask === "attention" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono-num text-[#94A3B8]">
                  <span>GO / NO-GO VIGILANCE TEST (10 STIMULI)</span>
                  <span>STEP: {attTrialIdx}/10</span>
                </div>
                {attStage !== "running" ? (
                  <div className="space-y-3">
                    <p className="text-xs text-[#CBD5E1]">
                      Tap the pad ONLY when <strong className="text-[#38BDF8]">TARGET (CYAN)</strong>{" "}
                      appears. Withhold response on <strong className="text-[#F59E0B]">DECOY (AMBER)</strong>.
                    </p>
                    <ButtonInButton onClick={startAttentionTask}>
                      {attStage === "done" ? "Re-Run Vigilance Task" : "Start Vigilance Task"}
                    </ButtonInButton>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAttentionTap}
                    className={`flex h-44 w-full items-center justify-center rounded-2xl border text-2xl font-mono-num font-bold tracking-widest cursor-pointer orbital-transition ${
                      attStimulus === "TARGET"
                        ? "border-[#00E5FF] bg-[#38BDF8]/25 text-[#38BDF8]"
                        : attStimulus === "DECOY"
                        ? "border-[#F59E0B] bg-[#F59E0B]/20 text-[#FBBF24]"
                        : "border-white/10 bg-[#080C14] text-[#475569]"
                    }`}
                  >
                    {attStimulus ? attStimulus : "..."}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Recent Cognitive Test Results */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-xs font-mono-num uppercase tracking-wider text-[#94A3B8]">
              Recent Task Logs ({astronautId})
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {testHistory.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0D131F] px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <div className="font-medium text-[#F1F5F9] capitalize">
                      {t.test_type.replace("_", " ")}
                      {t.is_synthetic && (
                        <span className="ml-2 text-[10px] font-mono-num text-[#FBBF24]">
                          SYNTHETIC
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono-num text-[#94A3B8]">
                      Base: {t.baseline_value} {t.unit}
                    </div>
                  </div>
                  <div className="text-right font-mono-num">
                    <div className="text-sm font-semibold text-[#F1F5F9]">
                      {t.score} {t.unit}
                    </div>
                    <div className={t.anomaly_detected ? "text-[#FBBF24]" : "text-[#34D399]"}>
                      {t.change_percent >= 0 ? "+" : ""}
                      {t.change_percent}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DoubleBezelCard>
    </div>
  );
}
