"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ActivityIcon as Activity,
  Brain,
  ChartLineUp,
  Eye,
  Heart,
  MoonStars,
  Radio,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  astraApi,
  AstronautProfile,
  CognitiveAudioResponse,
  CognitiveTestResult,
  DigitalTwinForecast,
  HealthIntelligenceReport,
  VisionAnalysisResponse,
} from "@/lib/api";
import { useAstra } from "./AstraContext";
import {
  ButtonInButton,
  DisclaimerBanner,
  DoubleBezelCard,
  EyebrowTag,
  StatusPill,
  SyntheticBadge,
} from "./DoubleBezel";

export function DashboardView() {
  const { astronautId, astronauts } = useAstra();
  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [vision, setVision] = useState<VisionAnalysisResponse | null>(null);
  const [audio, setAudio] = useState<CognitiveAudioResponse | null>(null);
  const [tests, setTests] = useState<CognitiveTestResult[]>([]);
  const [intel, setIntel] = useState<HealthIntelligenceReport | null>(null);
  const [twin, setTwin] = useState<DigitalTwinForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadAll() {
      setLoading(true);
      try {
        const [p, vh, ch, hi, dt] = await Promise.all([
          astraApi.getAstronaut(astronautId),
          astraApi.getVisionHistory(astronautId),
          astraApi.getCognitiveHistory(astronautId),
          astraApi.getLatestIntelligence(astronautId),
          astraApi.getDigitalTwinForecast(astronautId),
        ]);
        if (!active) return;
        setProfile(p);
        setVision(vh.find((v) => v.status === "ok") || vh[0] || null);
        setAudio(ch.audio_analyses.find((a) => a.status === "ok") || ch.audio_analyses[0] || null);
        setTests(ch.test_results || []);
        setIntel(hi);
        setTwin(dt);
      } catch {
        // handled gracefully via empty state
      } finally {
        if (active) setLoading(false);
      }
    }
    loadAll();
    return () => {
      active = false;
    };
  }, [astronautId]);

  const latestTelemetry =
    profile?.telemetry_history[profile.telemetry_history.length - 1] ?? null;

  const chartData =
    profile?.telemetry_history.slice(-14).map((t) => ({
      day: `MD ${t.mission_day}`,
      sleep: t.sleep_hours,
      rhr: t.resting_heart_rate_bpm,
      workload: t.workload_index,
    })) ?? [];

  const twinChartData =
    twin?.history_and_forecast.slice(-20).map((pt) => ({
      label: pt.label,
      readiness: pt.cognitive_readiness,
      fatigue: pt.fatigue_index,
    })) ?? [];

  return (
    <div className="space-y-8 animate-orbital-enter">
      {/* Flight Deck Hero Header */}
      <DoubleBezelCard>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <EyebrowTag>ASTRA MISSION CONTROL · ONBOARD AUTONOMOUS CORE</EyebrowTag>
              {profile?.is_synthetic_seed && <SyntheticBadge />}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#F1F5F9] sm:text-4xl">
              Your health. Your digital twin. Your mission.
            </h1>
            <p className="text-sm leading-relaxed text-[#94A3B8]">
              Continuous offline-first crew health intelligence fusing facial &amp; periorbital screening,
              acoustic/cognitive markers, and personal baseline telemetry for long-duration spaceflight.
            </p>
          </div>

          {/* Active Crew & Health Status Box */}
          <div className="flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#0D131F] p-5 lg:w-auto lg:min-w-[300px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono-num uppercase tracking-widest text-[#94A3B8]">
                  Active Crew Member
                </div>
                <div className="mt-1 text-lg font-semibold text-[#F1F5F9]">
                  {profile?.name || "Loading..."}
                </div>
                <div className="text-xs font-mono-num text-[#38BDF8]">
                  {profile?.astronaut_id} · Mission Day {profile?.mission_day ?? "—"}
                </div>
              </div>
              {intel && <StatusPill status={intel.overall_status} />}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-xs">
              <div>
                <span className="block text-[#94A3B8]">Risk Index</span>
                <span className="font-mono-num text-base font-semibold text-[#F1F5F9]">
                  {intel ? `${intel.risk_score}/100` : "—"}
                </span>
              </div>
              <div>
                <span className="block text-[#94A3B8]">Signal Completeness</span>
                <span className="font-mono-num text-base font-semibold text-[#38BDF8]">
                  {intel ? `${Math.round(intel.data_completeness * 100)}%` : "—"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/vision">
                <ButtonInButton>Run Vision Scan</ButtonInButton>
              </Link>
              <Link href="/intelligence">
                <ButtonInButton variant="secondary">Fusion Report</ButtonInButton>
              </Link>
            </div>
          </div>
        </div>
      </DoubleBezelCard>

      {/* Primary KPI Telemetry Row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <DoubleBezelCard innerClassName="p-5">
          <div className="flex items-center justify-between text-[#94A3B8]">
            <span className="text-xs uppercase tracking-wider">Resting Heart Rate</span>
            <Heart size={18} weight="light" className="text-[#38BDF8]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold font-mono-num text-[#F1F5F9]">
              {latestTelemetry ? latestTelemetry.resting_heart_rate_bpm : "—"}
            </span>
            <span className="text-xs font-mono-num text-[#94A3B8]">bpm</span>
          </div>
          <div className="mt-2 text-xs font-mono-num text-[#94A3B8]">
            Baseline: {profile?.baseline.resting_heart_rate_bpm ?? "—"} bpm
          </div>
        </DoubleBezelCard>

        <DoubleBezelCard innerClassName="p-5">
          <div className="flex items-center justify-between text-[#94A3B8]">
            <span className="text-xs uppercase tracking-wider">Latest Sleep Window</span>
            <MoonStars size={18} weight="light" className="text-[#38BDF8]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold font-mono-num text-[#F1F5F9]">
              {latestTelemetry ? latestTelemetry.sleep_hours : "—"}
            </span>
            <span className="text-xs font-mono-num text-[#94A3B8]">hrs</span>
          </div>
          <div className="mt-2 text-xs font-mono-num text-[#94A3B8]">
            Baseline: {profile?.baseline.sleep_hours ?? "—"} hrs
          </div>
        </DoubleBezelCard>

        <DoubleBezelCard innerClassName="p-5">
          <div className="flex items-center justify-between text-[#94A3B8]">
            <span className="text-xs uppercase tracking-wider">Latest Vision Delta</span>
            <Eye size={18} weight="light" className="text-[#38BDF8]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold font-mono-num text-[#F1F5F9]">
              {vision && vision.status === "ok"
                ? `${vision.baseline_comparison.periorbital_change_percent >= 0 ? "+" : ""}${
                    vision.baseline_comparison.periorbital_change_percent
                  }%`
                : "Pending"}
            </span>
          </div>
          <div className="mt-2 text-xs font-mono-num text-[#94A3B8]">
            {vision
              ? `Quality: ${Math.round(vision.image_quality * 100)}% (${vision.status})`
              : "No facial capture yet"}
          </div>
        </DoubleBezelCard>

        <DoubleBezelCard innerClassName="p-5">
          <div className="flex items-center justify-between text-[#94A3B8]">
            <span className="text-xs uppercase tracking-wider">Cognitive Readiness</span>
            <Brain size={18} weight="light" className="text-[#38BDF8]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold font-mono-num text-[#F1F5F9]">
              {tests[0] ? `${tests[0].score}` : "—"}
            </span>
            <span className="text-xs font-mono-num text-[#94A3B8]">
              {tests[0]?.unit || ""}
            </span>
          </div>
          <div className="mt-2 text-xs font-mono-num text-[#94A3B8]">
            {tests[0]
              ? `${tests[0].test_type.replace("_", " ")} (${tests[0].change_percent >= 0 ? "+" : ""}${
                  tests[0].change_percent
                }%)`
              : "No cognitive task yet"}
          </div>
        </DoubleBezelCard>
      </div>

      {/* Asymmetrical Bento: Telemetry Trends + Health Intelligence Factors */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <DoubleBezelCard className="lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <EyebrowTag>14-DAY MISSION TELEMETRY</EyebrowTag>
              <h2 className="mt-2 text-xl font-semibold text-[#F1F5F9]">
                Sleep Duration vs Resting Heart Rate
              </h2>
            </div>
            <SyntheticBadge />
          </div>

          <div className="h-[260px] w-full">
            {loading || chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#94A3B8]">
                Loading mission telemetry stream...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke="#64748B" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#38BDF8" fontSize={11} domain={[4, 10]} />
                  <YAxis yAxisId="right" orientation="right" stroke="#F59E0B" fontSize={11} domain={[50, 85]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#080C14",
                      border: "1px solid rgba(148,163,184,0.25)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  {profile && (
                    <ReferenceLine
                      yAxisId="left"
                      y={profile.baseline.sleep_hours}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                    />
                  )}
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="sleep"
                    name="Sleep (hrs)"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    fill="url(#sleepGrad)"
                    isAnimationActive={false}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="rhr"
                    name="Resting HR (bpm)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fillOpacity={0}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </DoubleBezelCard>

        <DoubleBezelCard className="lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <EyebrowTag tone={intel?.overall_status === "Red" ? "red" : intel?.overall_status === "Yellow" ? "amber" : "emerald"}>
                HEALTH INTELLIGENCE SUMMARY
              </EyebrowTag>
              <h2 className="mt-2 text-xl font-semibold text-[#F1F5F9]">
                Multi-Signal Attribution
              </h2>
            </div>
            <Radio size={20} weight="light" className="text-[#38BDF8]" />
          </div>

          <p className="text-sm leading-relaxed text-[#CBD5E1] mb-4">
            {intel?.explanation || "Awaiting initial multi-signal Health Intelligence run."}
          </p>

          <div className="space-y-2.5 mb-5">
            {intel && intel.detected_signals.length > 0 ? (
              intel.detected_signals.slice(0, 3).map((sig, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-[#0D131F] p-3 text-xs"
                >
                  <WarningCircle
                    size={16}
                    weight="light"
                    className={
                      sig.severity === "Red" ? "text-[#EF4444] shrink-0 mt-0.5" : "text-[#F59E0B] shrink-0 mt-0.5"
                    }
                  />
                  <div>
                    <div className="font-mono-num uppercase text-[11px] text-[#F1F5F9]">
                      {sig.source_module} · {sig.deviation_percent >= 0 ? "+" : ""}
                      {sig.deviation_percent}%
                    </div>
                    <div className="text-[#94A3B8] mt-0.5">{sig.summary}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-[#10B981]/25 bg-[#10B981]/5 p-3 text-xs text-[#34D399]">
                No critical anomalies flagged in latest run. Missing signals:{" "}
                {intel?.missing_signals.length ? intel.missing_signals.join(", ") : "None"}.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/cognitive">
              <ButtonInButton variant="secondary">Open Cognitive Lab</ButtonInButton>
            </Link>
            <Link href="/digital-twin">
              <ButtonInButton>Simulate What-If</ButtonInButton>
            </Link>
          </div>
        </DoubleBezelCard>
      </div>

      {/* Crew Roster + Digital Twin Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <DoubleBezelCard className="lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <EyebrowTag>CREW ROSTER</EyebrowTag>
              <h2 className="mt-2 text-xl font-semibold text-[#F1F5F9]">
                Monitored Flight Profiles
              </h2>
            </div>
            <Link
              href="/astronauts"
              className="text-xs font-mono-num text-[#38BDF8] hover:underline"
            >
              Manage Crew →
            </Link>
          </div>
          <div className="space-y-3">
            {astronauts.map((a) => (
              <div
                key={a.astronaut_id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0D131F] p-3.5"
              >
                <div>
                  <div className="text-sm font-medium text-[#F1F5F9]">
                    {a.name}{" "}
                    <span className="font-mono-num text-xs text-[#38BDF8]">({a.astronaut_id})</span>
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    {a.mission_name} · MD {a.mission_day}
                  </div>
                </div>
                <StatusPill status={a.latest_status} />
              </div>
            ))}
          </div>

          {audio && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#0D131F] p-4">
              <div className="flex items-center justify-between text-xs font-mono-num text-[#94A3B8]">
                <span>LATEST VOICE CHECK-IN ({audio.status.toUpperCase()})</span>
                <Activity size={15} weight="light" className="text-[#38BDF8]" />
              </div>
              <p className="mt-2 text-xs italic text-[#CBD5E1] line-clamp-2">
                &ldquo;{audio.transcript || audio.error_detail}&rdquo;
              </p>
            </div>
          )}
        </DoubleBezelCard>

        <DoubleBezelCard className="lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <EyebrowTag>DIGITAL TWIN · 14-DAY TRAJECTORY</EyebrowTag>
              <h2 className="mt-2 text-xl font-semibold text-[#F1F5F9]">
                Readiness &amp; Fatigue Projection
              </h2>
            </div>
            <Link href="/digital-twin" className="inline-flex items-center gap-1.5 text-xs font-mono-num text-[#38BDF8] hover:underline">
              <ChartLineUp size={15} weight="light" />
              Interactive What-If Controls →
            </Link>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={twinChartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="twinReadyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} domain={[20, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#080C14",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="readiness"
                  name="Cognitive Readiness"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#twinReadyGrad)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="fatigue"
                  name="Fatigue Index"
                  stroke="#F59E0B"
                  strokeWidth={1.8}
                  fillOpacity={0}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DoubleBezelCard>
      </div>

      <DisclaimerBanner text="ASTRA is an autonomous spaceflight decision-support MVP. All Yellow/Red rules and synthetic mission histories are demonstration models—not validated NASA flight-surgeon clinical diagnostics." />
    </div>
  );
}
