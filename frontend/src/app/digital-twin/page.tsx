"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChartLineUp, SlidersHorizontal } from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  astraApi,
  DigitalTwinForecast,
  WhatIfPayload,
  WhatIfScenarioResponse,
} from "@/lib/api";
import { useAstra } from "@/components/AstraContext";
import {
  ButtonInButton,
  DisclaimerBanner,
  DoubleBezelCard,
  EyebrowTag,
  SyntheticBadge,
} from "@/components/DoubleBezel";

export default function DigitalTwinPage() {
  const { astronautId } = useAstra();
  const [forecast, setForecast] = useState<DigitalTwinForecast | null>(null);
  const [sim, setSim] = useState<WhatIfScenarioResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const [inputs, setInputs] = useState<WhatIfPayload>({
    astronaut_id: astronautId,
    sleep_hours: 8.2,
    exercise_minutes: 75,
    nutrition_score: 90,
    hydration_liters: 2.8,
    workload_index: 50,
  });

  useEffect(() => {
    setInputs((prev) => ({ ...prev, astronaut_id: astronautId }));
  }, [astronautId]);

  const loadForecastAndSim = useCallback(async () => {
    try {
      const fc = await astraApi.getDigitalTwinForecast(astronautId);
      setForecast(fc);
      const s = await astraApi.simulateWhatIf({
        astronaut_id: astronautId,
        sleep_hours: 8.2,
        exercise_minutes: 75,
        nutrition_score: 90,
        hydration_liters: 2.8,
        workload_index: 50,
      });
      setSim(s);
    } catch {
      // handled
    }
  }, [astronautId]);

  useEffect(() => {
    loadForecastAndSim();
  }, [loadForecastAndSim]);

  async function runSimulation(nextInputs: WhatIfPayload) {
    setBusy(true);
    try {
      const res = await astraApi.simulateWhatIf(nextInputs);
      setSim(res);
    } finally {
      setBusy(false);
    }
  }

  const historyForecastChart =
    forecast?.history_and_forecast.map((pt) => ({
      label: pt.label,
      readiness: pt.cognitive_readiness,
      fatigue: pt.fatigue_index,
      upper: Math.min(100, Number((pt.cognitive_readiness + pt.uncertainty_band).toFixed(1))),
      lower: Math.max(0, Number((pt.cognitive_readiness - pt.uncertainty_band).toFixed(1))),
      phase: pt.is_forecast ? "Forecast" : "History",
    })) ?? [];

  const compareChart =
    sim?.baseline_scenario.map((b, idx) => ({
      label: b.label,
      baselineReadiness: b.cognitive_readiness,
      adjustedReadiness: sim.adjusted_scenario[idx]?.cognitive_readiness ?? b.cognitive_readiness,
      baselineFatigue: b.fatigue_index,
      adjustedFatigue: sim.adjusted_scenario[idx]?.fatigue_index ?? b.fatigue_index,
    })) ?? [];

  return (
    <div className="space-y-8 animate-orbital-enter">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <EyebrowTag>MODULE 5 · PERSONAL DIGITAL TWIN &amp; WHAT-IF SIMULATOR</EyebrowTag>
          <h1 className="mt-2 text-3xl font-semibold text-[#F1F5F9]">
            14-Day Scenario Trajectory &amp; Countermeasure Modeling
          </h1>
        </div>
        <SyntheticBadge />
      </div>

      <DisclaimerBanner text="Scenario Modeling Notice: Digital Twin outputs are transparent mathematical scenario estimates based on historical trends and linear-coupled assumptions—NOT guaranteed physiological or clinical predictions." />

      {/* 1. History + 14-Day Projection */}
      <DoubleBezelCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-mono-num uppercase text-[#94A3B8]">
              HISTORICAL TELEMETRY + 14-DAY STATUS-QUO PROJECTION
            </div>
            <h2 className="mt-1 text-xl font-semibold text-[#F1F5F9]">
              Cognitive Readiness &amp; Fatigue Trajectory ({astronautId})
            </h2>
          </div>
          {forecast && (
            <div className="text-xs font-mono-num text-[#38BDF8]">
              Current MD {forecast.current_mission_day} · Personal Baseline Readiness:{" "}
              {forecast.baseline_readiness}
            </div>
          )}
        </div>

        <div className="h-[290px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyForecastChart} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
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
              <Legend />
              {forecast && (
                <ReferenceLine
                  y={forecast.baseline_readiness}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  label={{ value: "Personal Baseline", fill: "#10B981", fontSize: 11 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="upper"
                name="Upper Uncertainty"
                stroke="transparent"
                fill="rgba(56,189,248,0.08)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="readiness"
                name="Cognitive Readiness"
                stroke="#38BDF8"
                strokeWidth={2.2}
                fill="url(#readinessFill)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="fatigue"
                name="Fatigue Index"
                stroke="#F59E0B"
                strokeWidth={2}
                fillOpacity={0}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </DoubleBezelCard>

      {/* 2. Interactive What-If Simulator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls */}
        <DoubleBezelCard className="lg:col-span-5">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal size={20} weight="light" className="text-[#38BDF8]" />
            <h2 className="text-lg font-semibold text-[#F1F5F9]">
              What-If Regimen Parameters
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                key: "sleep_hours",
                label: "Target Sleep Duration",
                unit: "hrs/night",
                min: 4.5,
                max: 10.0,
                step: 0.1,
              },
              {
                key: "exercise_minutes",
                label: "Resistive & Aerobic Exercise",
                unit: "min/day",
                min: 15,
                max: 140,
                step: 5,
              },
              {
                key: "nutrition_score",
                label: "Nutrition & Micronutrient Index",
                unit: "%",
                min: 45,
                max: 100,
                step: 1,
              },
              {
                key: "hydration_liters",
                label: "Hydration Intake",
                unit: "L/day",
                min: 1.2,
                max: 4.2,
                step: 0.1,
              },
              {
                key: "workload_index",
                label: "Mission Operational Workload",
                unit: "%",
                min: 20,
                max: 95,
                step: 1,
              },
            ].map((slider) => {
              const val = inputs[slider.key as keyof WhatIfPayload] as number;
              return (
                <div key={slider.key} className="rounded-xl bg-[#0D131F] p-3.5">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#CBD5E1]">{slider.label}</span>
                    <span className="font-mono-num font-semibold text-[#38BDF8]">
                      {val} {slider.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={val}
                    onChange={(e) => {
                      const next = { ...inputs, [slider.key]: Number(e.target.value) };
                      setInputs(next);
                    }}
                    className="w-full accent-[#38BDF8] cursor-pointer"
                  />
                </div>
              );
            })}

            <ButtonInButton
              onClick={() => runSimulation(inputs)}
              disabled={busy}
              className="w-full"
            >
              {busy ? "Simulating..." : "Recalculate What-If Comparison"}
            </ButtonInButton>
          </div>
        </DoubleBezelCard>

        {/* Scenario Comparison Chart & Formulas */}
        <DoubleBezelCard className="lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <ChartLineUp size={20} weight="light" className="text-[#10B981]" />
              <h2 className="text-lg font-semibold text-[#F1F5F9]">
                Baseline vs Adjusted 14-Day Scenario
              </h2>
            </div>
          </div>

          {sim && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Day +14 Readiness</div>
                  <div
                    className={`mt-1 text-xl font-mono-num font-semibold ${
                      sim.day_14_delta.cognitive_readiness_delta >= 0
                        ? "text-[#34D399]"
                        : "text-[#F87171]"
                    }`}
                  >
                    {sim.day_14_delta.cognitive_readiness_delta >= 0 ? "+" : ""}
                    {sim.day_14_delta.cognitive_readiness_delta} pts
                  </div>
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Day +14 Fatigue</div>
                  <div
                    className={`mt-1 text-xl font-mono-num font-semibold ${
                      sim.day_14_delta.fatigue_index_delta <= 0
                        ? "text-[#34D399]"
                        : "text-[#FBBF24]"
                    }`}
                  >
                    {sim.day_14_delta.fatigue_index_delta >= 0 ? "+" : ""}
                    {sim.day_14_delta.fatigue_index_delta} pts
                  </div>
                </div>
                <div className="rounded-xl bg-[#0D131F] p-3">
                  <div className="text-[11px] text-[#94A3B8]">Day +14 Recovery</div>
                  <div className="mt-1 text-xl font-mono-num font-semibold text-[#38BDF8]">
                    {sim.day_14_delta.recovery_score_delta >= 0 ? "+" : ""}
                    {sim.day_14_delta.recovery_score_delta} pts
                  </div>
                </div>
              </div>

              <div className="h-[230px] w-full mb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={compareChart} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} domain={[25, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#080C14",
                        border: "1px solid rgba(148,163,184,0.25)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="baselineReadiness"
                      name="Baseline Trajectory"
                      stroke="#64748B"
                      strokeDasharray="5 4"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="adjustedReadiness"
                      name="Adjusted Scenario"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ r: 2.5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0D131F] p-4 space-y-2 text-xs">
                <p className="text-[#E2E8F0]">{sim.explanation}</p>
                <div className="pt-2 border-t border-white/10">
                  <div className="font-mono-num uppercase text-[10px] text-[#38BDF8] mb-1">
                    Transparent Model Equations &amp; Assumptions
                  </div>
                  {sim.formulas_used.map((f, i) => (
                    <div key={i} className="font-mono-num text-[11px] text-[#94A3B8]">
                      • {f}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DoubleBezelCard>
      </div>
    </div>
  );
}
