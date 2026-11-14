"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FloppyDisk, PlusCircle, UserCircle } from "@phosphor-icons/react";
import { astraApi, AstronautProfile, BaselineProfile } from "@/lib/api";
import { useAstra } from "@/components/AstraContext";
import {
  ButtonInButton,
  DoubleBezelCard,
  EyebrowTag,
  SyntheticBadge,
} from "@/components/DoubleBezel";

export default function AstronautsPage() {
  const { astronautId, setAstronautId, refreshGlobal } = useAstra();
  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [baselineDraft, setBaselineDraft] = useState<BaselineProfile | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Create Crew Form
  const [showCreate, setShowCreate] = useState(false);
  const [newCrew, setNewCrew] = useState({
    astronaut_id: "",
    name: "",
    age: 35,
    height_cm: 175,
    weight_kg: 70,
    mission_name: "Artemis Lunar South Pole Prep",
    mission_day: 1,
    blood_type: "A+",
    medical_history: "Pre-flight physical cleared.",
  });

  // Live Telemetry Log Form
  const [teleDraft, setTeleDraft] = useState({
    mission_day: 31,
    resting_heart_rate_bpm: 64,
    sleep_hours: 7.2,
    sleep_quality_score: 84,
    activity_minutes: 70,
    hydration_liters: 2.5,
    nutrition_score: 86,
    workload_index: 65,
    self_report_mood: "Steady",
    self_report_fatigue: 4,
  });

  const loadProfile = useCallback(async () => {
    try {
      const p = await astraApi.getAstronaut(astronautId);
      setProfile(p);
      setBaselineDraft(p.baseline);
      setTeleDraft((prev) => ({ ...prev, mission_day: p.mission_day + 1 }));
    } catch {
      // handled
    }
  }, [astronautId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleSaveBaseline(e: React.FormEvent) {
    e.preventDefault();
    if (!baselineDraft) return;
    setStatusMsg(null);
    try {
      const updated = await astraApi.updateBaseline(astronautId, baselineDraft);
      setProfile(updated);
      setStatusMsg("Personal baseline saved to local SQLite.");
      await refreshGlobal();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Failed to save baseline");
    }
  }

  async function handleCreateCrew(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const created = await astraApi.createAstronaut({
        ...newCrew,
        astronaut_id: newCrew.astronaut_id.trim() || undefined,
      });
      await refreshGlobal();
      setAstronautId(created.astronaut_id);
      setShowCreate(false);
      setStatusMsg(`Created crew profile ${created.astronaut_id} (${created.name}).`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Failed to create profile");
    }
  }

  async function handleLogTelemetry(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await astraApi.addTelemetry(astronautId, { ...teleDraft, is_synthetic: false });
      await loadProfile();
      await refreshGlobal();
      setStatusMsg(`Logged live mission telemetry for Day ${teleDraft.mission_day}.`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Failed to log telemetry");
    }
  }

  return (
    <div className="space-y-8 animate-orbital-enter">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <EyebrowTag>MODULE 1 · ASTRONAUT PROFILE &amp; BASELINE</EyebrowTag>
          <h1 className="mt-2 text-3xl font-semibold text-[#F1F5F9]">
            Crew Medical Identity &amp; Individual Norms
          </h1>
        </div>
        <ButtonInButton variant="secondary" onClick={() => setShowCreate(!showCreate)}>
          <span className="inline-flex items-center gap-2">
            <PlusCircle size={16} weight="light" />
            {showCreate ? "Close New Crew Form" : "Register Crew Profile"}
          </span>
        </ButtonInButton>
      </div>

      {statusMsg && (
        <div className="rounded-2xl border border-[#38BDF8]/35 bg-[#38BDF8]/10 px-4 py-3 text-sm text-[#E0F2FE]">
          {statusMsg}
        </div>
      )}

      {/* Create Crew Drawer */}
      {showCreate && (
        <DoubleBezelCard>
          <h2 className="text-lg font-semibold text-[#F1F5F9] mb-4">
            Register New Astronaut Profile
          </h2>
          <form onSubmit={handleCreateCrew} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-[#94A3B8]">
              Astronaut ID (optional)
              <input
                type="text"
                placeholder="e.g. AST-002"
                value={newCrew.astronaut_id}
                onChange={(e) => setNewCrew({ ...newCrew, astronaut_id: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2.5 text-sm text-[#F1F5F9]"
              />
            </label>
            <label className="text-xs text-[#94A3B8]">
              Full Name *
              <input
                type="text"
                required
                placeholder="Dr. Aris Thorne"
                value={newCrew.name}
                onChange={(e) => setNewCrew({ ...newCrew, name: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2.5 text-sm text-[#F1F5F9]"
              />
            </label>
            <label className="text-xs text-[#94A3B8]">
              Mission Name *
              <input
                type="text"
                required
                value={newCrew.mission_name}
                onChange={(e) => setNewCrew({ ...newCrew, mission_name: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2.5 text-sm text-[#F1F5F9]"
              />
            </label>
            <label className="text-xs text-[#94A3B8]">
              Mission Day
              <input
                type="number"
                min={1}
                value={newCrew.mission_day}
                onChange={(e) => setNewCrew({ ...newCrew, mission_day: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2.5 text-sm text-[#F1F5F9]"
              />
            </label>
            <label className="text-xs text-[#94A3B8]">
              Age
              <input
                type="number"
                min={20}
                max={80}
                value={newCrew.age}
                onChange={(e) => setNewCrew({ ...newCrew, age: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2.5 text-sm text-[#F1F5F9]"
              />
            </label>
            <label className="text-xs text-[#94A3B8]">
              Height (cm)
              <input
                type="number"
                value={newCrew.height_cm}
                onChange={(e) => setNewCrew({ ...newCrew, height_cm: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2.5 text-sm text-[#F1F5F9]"
              />
            </label>
            <label className="text-xs text-[#94A3B8]">
              Weight (kg)
              <input
                type="number"
                value={newCrew.weight_kg}
                onChange={(e) => setNewCrew({ ...newCrew, weight_kg: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2.5 text-sm text-[#F1F5F9]"
              />
            </label>
            <label className="text-xs text-[#94A3B8]">
              Blood Type
              <input
                type="text"
                value={newCrew.blood_type}
                onChange={(e) => setNewCrew({ ...newCrew, blood_type: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2.5 text-sm text-[#F1F5F9]"
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-2">
              <ButtonInButton type="submit">Create Astronaut in SQLite</ButtonInButton>
            </div>
          </form>
        </DoubleBezelCard>
      )}

      {/* Main Profile + Baseline Calibration Grid */}
      {profile && baselineDraft && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Medical Identity Card */}
          <DoubleBezelCard className="lg:col-span-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]">
                  <UserCircle size={28} weight="light" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#F1F5F9]">{profile.name}</h2>
                  <div className="text-xs font-mono-num text-[#38BDF8]">
                    {profile.astronaut_id} · Mission Day {profile.mission_day}
                  </div>
                </div>
              </div>
              {profile.is_synthetic_seed && <SyntheticBadge />}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-[#0D131F] p-3">
                <dt className="text-[#94A3B8]">Mission</dt>
                <dd className="mt-1 font-medium text-[#F1F5F9]">{profile.mission_name}</dd>
              </div>
              <div className="rounded-xl bg-[#0D131F] p-3">
                <dt className="text-[#94A3B8]">Vitals Spec</dt>
                <dd className="mt-1 font-mono-num text-[#F1F5F9]">
                  {profile.age}y · {profile.height_cm}cm · {profile.weight_kg}kg · {profile.blood_type}
                </dd>
              </div>
              <div className="col-span-2 rounded-xl bg-[#0D131F] p-3">
                <dt className="text-[#94A3B8]">Medical History</dt>
                <dd className="mt-1 text-[#CBD5E1] leading-relaxed">{profile.medical_history}</dd>
              </div>
              <div className="rounded-xl bg-[#0D131F] p-3">
                <dt className="text-[#94A3B8]">Allergies</dt>
                <dd className="mt-1 text-[#CBD5E1]">{profile.allergies}</dd>
              </div>
              <div className="rounded-xl bg-[#0D131F] p-3">
                <dt className="text-[#94A3B8]">Medications</dt>
                <dd className="mt-1 text-[#CBD5E1]">{profile.medications}</dd>
              </div>
            </dl>
          </DoubleBezelCard>

          {/* Baseline Calibration Form */}
          <DoubleBezelCard className="lg:col-span-7">
            <div className="flex items-center justify-between mb-4">
              <div>
                <EyebrowTag>INDIVIDUAL BASELINE REFERENCE</EyebrowTag>
                <h2 className="mt-2 text-xl font-semibold text-[#F1F5F9]">
                  Personal Norm Calibration
                </h2>
              </div>
            </div>

            <form onSubmit={handleSaveBaseline} className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              {[
                { key: "resting_heart_rate_bpm", label: "Resting HR (bpm)", step: "0.5" },
                { key: "sleep_hours", label: "Sleep Norm (hrs)", step: "0.1" },
                { key: "activity_minutes", label: "Activity (min/day)", step: "1" },
                { key: "reaction_time_ms", label: "Reaction Baseline (ms)", step: "1" },
                { key: "memory_score", label: "Memory Norm (%)", step: "1" },
                { key: "attention_score", label: "Attention Norm (%)", step: "1" },
                { key: "periorbital_index", label: "Periorbital Index", step: "0.5" },
                { key: "eye_redness_index", label: "Eye Redness Index", step: "0.5" },
                { key: "speech_rate_wpm", label: "Speech Rate (WPM)", step: "1" },
                { key: "pause_duration_sec", label: "Pause Mean (sec)", step: "0.01" },
                { key: "hydration_liters", label: "Hydration (L/day)", step: "0.1" },
                { key: "nutrition_score", label: "Nutrition Score (%)", step: "1" },
              ].map((field) => (
                <label key={field.key} className="text-xs text-[#94A3B8]">
                  {field.label}
                  <input
                    type="number"
                    step={field.step}
                    value={baselineDraft[field.key as keyof BaselineProfile]}
                    onChange={(e) =>
                      setBaselineDraft({
                        ...baselineDraft,
                        [field.key]: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2 text-sm font-mono-num text-[#F1F5F9]"
                  />
                </label>
              ))}
              <div className="sm:col-span-3 flex justify-end pt-2">
                <ButtonInButton type="submit">
                  <span className="inline-flex items-center gap-2">
                    <FloppyDisk size={16} weight="light" />
                    Update Baseline
                  </span>
                </ButtonInButton>
              </div>
            </form>
          </DoubleBezelCard>
        </div>
      )}

      {/* Live Telemetry & Private Self-Report Logger + History Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <DoubleBezelCard className="lg:col-span-5">
          <EyebrowTag tone="emerald">PRIVATE CREW SELF-REPORT &amp; BIOMETRICS</EyebrowTag>
          <h2 className="mt-2 text-xl font-semibold text-[#F1F5F9] mb-4">
            Log Daily Mission Entry
          </h2>
          <form onSubmit={handleLogTelemetry} className="grid grid-cols-2 gap-3 text-xs text-[#94A3B8]">
            <label>
              Mission Day
              <input
                type="number"
                value={teleDraft.mission_day}
                onChange={(e) => setTeleDraft({ ...teleDraft, mission_day: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2 text-sm font-mono-num text-[#F1F5F9]"
              />
            </label>
            <label>
              Resting HR (bpm)
              <input
                type="number"
                step="0.5"
                value={teleDraft.resting_heart_rate_bpm}
                onChange={(e) =>
                  setTeleDraft({ ...teleDraft, resting_heart_rate_bpm: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2 text-sm font-mono-num text-[#F1F5F9]"
              />
            </label>
            <label>
              Sleep (hrs)
              <input
                type="number"
                step="0.1"
                value={teleDraft.sleep_hours}
                onChange={(e) => setTeleDraft({ ...teleDraft, sleep_hours: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2 text-sm font-mono-num text-[#F1F5F9]"
              />
            </label>
            <label>
              Workload (0-100)
              <input
                type="number"
                value={teleDraft.workload_index}
                onChange={(e) => setTeleDraft({ ...teleDraft, workload_index: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2 text-sm font-mono-num text-[#F1F5F9]"
              />
            </label>
            <label>
              Self-Report Mood
              <input
                type="text"
                value={teleDraft.self_report_mood}
                onChange={(e) => setTeleDraft({ ...teleDraft, self_report_mood: e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2 text-sm text-[#F1F5F9]"
              />
            </label>
            <label>
              Fatigue (1-10)
              <input
                type="number"
                min={1}
                max={10}
                value={teleDraft.self_report_fatigue}
                onChange={(e) =>
                  setTeleDraft({ ...teleDraft, self_report_fatigue: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0D131F] px-3 py-2 text-sm font-mono-num text-[#F1F5F9]"
              />
            </label>
            <div className="col-span-2 pt-2">
              <ButtonInButton type="submit" className="w-full">
                Save Live Telemetry Point
              </ButtonInButton>
            </div>
          </form>
        </DoubleBezelCard>

        <DoubleBezelCard className="lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <EyebrowTag>MEASUREMENT LOG</EyebrowTag>
              <h2 className="mt-2 text-xl font-semibold text-[#F1F5F9]">
                Recent Mission History
              </h2>
            </div>
          </div>
          <div className="max-h-[340px] overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 font-mono-num uppercase text-[#94A3B8]">
                <tr>
                  <th className="py-2 pr-3">Day</th>
                  <th className="py-2 pr-3">Sleep</th>
                  <th className="py-2 pr-3">RHR</th>
                  <th className="py-2 pr-3">Workload</th>
                  <th className="py-2 pr-3">Mood</th>
                  <th className="py-2">Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] font-mono-num">
                {profile?.telemetry_history
                  .slice()
                  .reverse()
                  .slice(0, 12)
                  .map((t) => (
                    <tr key={t.id} className="text-[#CBD5E1]">
                      <td className="py-2.5 pr-3 text-[#38BDF8]">MD {t.mission_day}</td>
                      <td className="py-2.5 pr-3">{t.sleep_hours}h</td>
                      <td className="py-2.5 pr-3">{t.resting_heart_rate_bpm} bpm</td>
                      <td className="py-2.5 pr-3">{t.workload_index}%</td>
                      <td className="py-2.5 pr-3 font-sans">{t.self_report_mood || "—"}</td>
                      <td className="py-2.5">
                        {t.is_synthetic ? (
                          <span className="text-[#FBBF24]">SYNTHETIC</span>
                        ) : (
                          <span className="text-[#34D399]">LIVE</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DoubleBezelCard>
      </div>
    </div>
  );
}
