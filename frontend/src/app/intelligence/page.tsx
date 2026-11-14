"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIcon as Activity, CheckCircle, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { astraApi, HealthIntelligenceReport } from "@/lib/api";
import { useAstra } from "@/components/AstraContext";
import {
  ButtonInButton,
  DisclaimerBanner,
  DoubleBezelCard,
  EyebrowTag,
  StatusPill,
  SyntheticBadge,
} from "@/components/DoubleBezel";

export default function IntelligencePage() {
  const { astronautId, refreshGlobal } = useAstra();
  const [report, setReport] = useState<HealthIntelligenceReport | null>(null);
  const [selfNote, setSelfNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    try {
      const latest = await astraApi.getLatestIntelligence(astronautId);
      setReport(latest);
    } catch {
      // handled
    }
  }, [astronautId]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  async function handleRunFusion(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await astraApi.runHealthIntelligence(astronautId, selfNote);
      setReport(res);
      await refreshGlobal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Health Intelligence run failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 animate-orbital-enter">
      <div>
        <EyebrowTag>MODULE 4 · HEALTH INTELLIGENCE CORE</EyebrowTag>
        <h1 className="mt-2 text-3xl font-semibold text-[#F1F5F9]">
          Multi-Signal Risk Fusion &amp; Decision Support
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[#94A3B8]">
          Unifies Biometric &amp; Sleep Telemetry, Vision Monitoring, Cognitive Speech, and
          Controlled Task performance against {astronautId}&apos;s personal baseline to generate an
          explainable Green / Yellow / Red attention status.
        </p>
      </div>

      <DisclaimerBanner
        text={
          report?.thresholds_disclaimer ||
          "All Yellow/Red thresholds in ASTRA are demonstration MVP rules—not validated NASA flight surgeon criteria."
        }
      />

      {errorMsg && (
        <div className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#FCA5A5]">
          {errorMsg}
        </div>
      )}

      {/* Control Bar */}
      <DoubleBezelCard>
        <form onSubmit={handleRunFusion} className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex-1 text-xs text-[#94A3B8]">
            Private Crew Self-Report Context (Optional)
            <input
              type="text"
              placeholder="e.g. Slight orbital sleep disruption after EVA maintenance..."
              value={selfNote}
              onChange={(e) => setSelfNote(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0D131F] px-4 py-3 text-sm text-[#F1F5F9]"
            />
          </label>
          <ButtonInButton type="submit" disabled={busy}>
            {busy ? "Fusing Signals..." : "Run Health Intelligence"}
          </ButtonInButton>
        </form>
      </DoubleBezelCard>

      {report && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Overall Status & Causal Factors */}
          <DoubleBezelCard className="lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Activity size={24} weight="light" className="text-[#38BDF8]" />
                <div>
                  <div className="text-xs font-mono-num uppercase text-[#94A3B8]">
                    OVERALL FLIGHT ATTENTION STATUS
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-[#F1F5F9]">
                    Risk Score: <span className="font-mono-num">{report.risk_score} / 100</span>
                  </div>
                </div>
              </div>
              <StatusPill status={report.overall_status} />
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <div className="text-xs font-mono-num uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Explainable Summary
                </div>
                <p className="text-sm leading-relaxed text-[#E2E8F0]">{report.explanation}</p>
              </div>

              <div>
                <div className="text-xs font-mono-num uppercase tracking-wider text-[#94A3B8] mb-2.5">
                  Detected Deviation Signals ({report.detected_signals.length})
                </div>
                {report.detected_signals.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-3.5 text-xs text-[#A7F3D0]">
                    <CheckCircle size={18} weight="light" />
                    <span>All available signals sit within nominal baseline bounds.</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {report.detected_signals.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#0D131F] p-3.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <WarningCircle
                            size={18}
                            weight="light"
                            className={
                              f.severity === "Red"
                                ? "text-[#EF4444] mt-0.5 shrink-0"
                                : "text-[#F59E0B] mt-0.5 shrink-0"
                            }
                          />
                          <div>
                            <div className="text-xs font-mono-num uppercase text-[#F1F5F9]">
                              {f.source_module} · {f.signal}
                            </div>
                            <p className="mt-0.5 text-xs text-[#CBD5E1]">{f.summary}</p>
                          </div>
                        </div>
                        <span className="font-mono-num text-xs font-semibold text-[#FBBF24] shrink-0">
                          {f.deviation_percent >= 0 ? "+" : ""}
                          {f.deviation_percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-mono-num uppercase tracking-wider text-[#94A3B8] mb-2.5">
                  Recommended Next Steps
                </div>
                <ul className="space-y-2 text-xs text-[#CBD5E1]">
                  {report.recommended_next_steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5"
                    >
                      <ShieldCheck size={16} weight="light" className="text-[#38BDF8] shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </DoubleBezelCard>

          {/* Right: Signal Quality & Missing Data Matrix */}
          <DoubleBezelCard className="lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <EyebrowTag>SIGNAL QUALITY &amp; PROVENANCE</EyebrowTag>
                <h2 className="mt-2 text-lg font-semibold text-[#F1F5F9]">
                  Data Completeness: {Math.round(report.data_completeness * 100)}%
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {report.signal_qualities.map((q, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/10 bg-[#0D131F] p-3.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[#F1F5F9]">{q.signal_name}</span>
                    <div className="flex items-center gap-2">
                      {q.is_synthetic && <SyntheticBadge />}
                      <span
                        className={`font-mono-num px-2 py-0.5 rounded-full text-[10px] ${
                          q.available
                            ? "bg-[#10B981]/15 text-[#34D399]"
                            : "bg-[#EF4444]/15 text-[#FCA5A5]"
                        }`}
                      >
                        {q.available ? `Q: ${Math.round(q.quality_score * 100)}%` : "MISSING"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[#94A3B8]">{q.note}</div>
                </div>
              ))}
            </div>

            {report.missing_signals.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-3.5 text-xs text-[#FDE68A]">
                <strong className="font-mono-num uppercase">Missing Sources:</strong>{" "}
                {report.missing_signals.join(", ")}. System remains operational with explicit
                uncertainty disclosure.
              </div>
            )}
          </DoubleBezelCard>
        </div>
      )}
    </div>
  );
}
