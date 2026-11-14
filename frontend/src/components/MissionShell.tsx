"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon as Activity,
  Brain,
  ChartLineUp,
  Eye,
  HardDrive,
  IdentificationCard,
  Planet,
  WifiSlash,
} from "@phosphor-icons/react";
import { AstraProvider, useAstra } from "./AstraContext";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Mission Control", icon: Planet },
  { href: "/astronauts", label: "Crew Profile", icon: IdentificationCard },
  { href: "/vision", label: "Vision Scan", icon: Eye },
  { href: "/cognitive", label: "Cognitive Lab", icon: Brain },
  { href: "/intelligence", label: "Health Intel", icon: Activity },
  { href: "/digital-twin", label: "Digital Twin", icon: ChartLineUp },
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { astronautId, setAstronautId, astronauts, systemStatus, backendReachable } = useAstra();
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const activeCrew = astronauts.find((a) => a.astronaut_id === astronautId);

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      {/* Floating Island Navigation */}
      <header className="sticky top-0 z-40 px-4 pt-4 md:px-8">
        <nav
          aria-label="Primary Mission Navigation"
          className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 rounded-full border border-white/10 bg-[#080C14]/85 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85)]"
        >
          {/* Brand + Active Mission */}
          <Link
            href="/dashboard"
            className="flex min-h-[40px] shrink-0 items-center gap-2.5 pl-1 pr-1 group"
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#38BDF8]/40 bg-[#38BDF8]/10">
              <div className="h-2.5 w-2.5 rounded-full bg-[#00E5FF] animate-telemetry-pulse" />
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-semibold tracking-[0.18em] text-[#F1F5F9]">
                ASTRA
              </span>
              <span className="hidden xl:block text-[10px] font-mono-num uppercase tracking-[0.16em] text-[#94A3B8] whitespace-nowrap">
                Flight Health Intel
              </span>
            </div>
          </Link>

          {/* Desktop Routes */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (pathname === "/" && item.href === "/dashboard");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium orbital-transition ${
                    active
                      ? "bg-[#38BDF8]/15 text-[#38BDF8] ring-1 ring-[#38BDF8]/35"
                      : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon size={15} weight="light" className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Telemetry Controls */}
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {/* Astronaut Selector */}
            <label htmlFor="crew-select" className="sr-only">
              Select Astronaut
            </label>
            <select
              id="crew-select"
              value={astronautId}
              onChange={(e) => setAstronautId(e.target.value)}
              className="min-h-[40px] max-w-[130px] sm:max-w-none truncate rounded-full border border-white/15 bg-[#0D131F] px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-mono-num text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#38BDF8]"
            >
              {astronauts.length === 0 ? (
                <option value="AST-001">AST-001</option>
              ) : (
                astronauts.map((a) => (
                  <option key={a.astronaut_id} value={a.astronaut_id}>
                    {a.astronaut_id} · MD {a.mission_day}
                  </option>
                ))
              )}
            </select>

            {/* Offline Mode Pill */}
            <button
              type="button"
              onClick={() => setQueueOpen(!queueOpen)}
              className="hidden sm:inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-3.5 py-1.5 text-[11px] font-mono-num uppercase tracking-wider text-[#34D399] hover:bg-[#10B981]/15 cursor-pointer orbital-transition"
              title="Local SQLite Storage & Sync Queue"
            >
              <WifiSlash size={14} weight="light" />
              <span>{backendReachable ? "OFFLINE-FIRST" : "API RETRY"}</span>
              {systemStatus && (
                <span className="rounded-full bg-[#10B981]/20 px-1.5 py-0.5 text-[10px]">
                  {systemStatus.offline_sync_queued_count}
                </span>
              )}
            </button>

            {/* Hamburger Morph Toggle (Mobile/Tablet) */}
            <button
              type="button"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] cursor-pointer"
            >
              <span
                className={`absolute h-[1.5px] w-4 bg-[#F1F5F9] orbital-transition ${
                  menuOpen ? "rotate-45 translate-y-0" : "-translate-y-1.5"
                }`}
              />
              <span
                className={`absolute h-[1.5px] w-4 bg-[#F1F5F9] orbital-transition ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute h-[1.5px] w-4 bg-[#F1F5F9] orbital-transition ${
                  menuOpen ? "-rotate-45 translate-y-0" : "translate-y-1.5"
                }`}
              />
            </button>
          </div>
        </nav>

        {/* Active Crew Micro Strip */}
        {activeCrew && (
          <div className="mx-auto mt-2 hidden md:flex max-w-7xl items-center justify-between px-4 text-[11px] font-mono-num text-[#94A3B8]">
            <span>
              ACTIVE CREW: <strong className="text-[#F1F5F9]">{activeCrew.name}</strong> ({activeCrew.astronaut_id}) · {activeCrew.mission_name}
            </span>
            <span>
              MISSION DAY {activeCrew.mission_day} · LOCAL SQLITE PERSISTENCE ENABLED
            </span>
          </div>
        )}
      </header>

      {/* Mobile Fullscreen Overlay Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-center bg-[#04060A]/92 px-6 backdrop-blur-3xl lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#F1F5F9]"
          >
            ✕
          </button>
          <div className="space-y-3">
            {NAV_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{ transitionDelay: `${idx * 45}ms` }}
                  className={`flex min-h-[52px] items-center gap-4 rounded-2xl border px-5 py-3 text-lg font-medium orbital-transition ${
                    active
                      ? "border-[#38BDF8]/40 bg-[#38BDF8]/15 text-[#38BDF8]"
                      : "border-white/10 bg-white/[0.03] text-[#F1F5F9]"
                  }`}
                >
                  <Icon size={22} weight="light" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Offline Sync Queue Drawer */}
      {queueOpen && systemStatus && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 p-4 pt-20 backdrop-blur-sm">
          <div className="bezel-outer w-full max-w-md">
            <div className="bezel-inner space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <HardDrive size={18} weight="light" className="text-[#38BDF8]" />
                  <span>Onboard Local Storage & Sync Queue</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQueueOpen(false)}
                  className="rounded-full px-3 py-1 text-xs text-[#94A3B8] hover:bg-white/10 cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="rounded-xl bg-[#0D131F] p-3 text-xs font-mono-num space-y-1 text-[#CBD5E1]">
                <div>MODE: {systemStatus.mode}</div>
                <div>MEDIAPIPE MESH: {systemStatus.mediapipe_model_ready ? "READY (LOCAL)" : "MISSING"}</div>
                <div>WHISPER TINY.EN: {systemStatus.whisper_offline_ready ? "READY (LOCAL)" : "FALLBACK"}</div>
                <div>QUEUED RECORDS: {systemStatus.offline_sync_queued_count}</div>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {systemStatus.recent_sync_queue.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-xs"
                  >
                    <div className="flex justify-between font-mono-num text-[11px] text-[#38BDF8]">
                      <span>
                        {q.astronaut_id} · {q.module}
                      </span>
                      <span className="text-[#34D399]">{q.status}</span>
                    </div>
                    <div className="mt-1 text-[#CBD5E1]">{q.payload_summary}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8 md:py-10">
        {children}
      </main>

      {/* Mission Footer */}
      <footer className="border-t border-white/[0.07] bg-[#04060A]/90 px-4 py-6 text-xs text-[#94A3B8] md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="font-mono-num">
            ASTRA · Autonomous Spaceflight Health Intelligence · Offline-First MVP
          </div>
          <div>
            Demonstration screening & decision-support prototype only. Not a certified NASA clinical diagnostic system.
          </div>
        </div>
      </footer>
    </div>
  );
}

export function MissionShell({ children }: { children: React.ReactNode }) {
  return (
    <AstraProvider>
      <ShellInner>{children}</ShellInner>
    </AstraProvider>
  );
}
