"use client";

import React from "react";
import { ArrowUpRight, ShieldWarning } from "@phosphor-icons/react";
import { StatusLevel } from "@/lib/api";

export function DoubleBezelCard({
  children,
  className = "",
  innerClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={`bezel-outer ${className}`}>
      <div className={`bezel-inner p-6 md:p-7 ${innerClassName}`}>{children}</div>
    </div>
  );
}

export function EyebrowTag({
  children,
  tone = "cyan",
}: {
  children: React.ReactNode;
  tone?: "cyan" | "amber" | "emerald" | "red" | "slate";
}) {
  const styles: Record<string, string> = {
    cyan: "border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]",
    amber: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]",
    emerald: "border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]",
    red: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]",
    slate: "border-white/15 bg-white/5 text-[#94A3B8]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusPill({
  status,
  label,
}: {
  status: StatusLevel;
  label?: string;
}) {
  const palette: Record<StatusLevel, { wrap: string; dot: string }> = {
    Green: {
      wrap: "border-[#10B981]/35 bg-[#10B981]/12 text-[#34D399]",
      dot: "bg-[#10B981]",
    },
    Yellow: {
      wrap: "border-[#F59E0B]/35 bg-[#F59E0B]/12 text-[#FBBF24]",
      dot: "bg-[#F59E0B]",
    },
    Red: {
      wrap: "border-[#EF4444]/35 bg-[#EF4444]/12 text-[#F87171]",
      dot: "bg-[#EF4444]",
    },
  };
  const s = palette[status] || palette.Green;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wider uppercase font-mono-num ${s.wrap}`}
    >
      <span className={`h-2 w-2 rounded-full ${s.dot} animate-telemetry-pulse`} />
      {label || status}
    </span>
  );
}

export function SyntheticBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2.5 py-0.5 text-[10px] font-mono-num uppercase tracking-widest text-[#FBBF24]">
      DEMO / SYNTHETIC
    </span>
  );
}

export function ButtonInButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
  type?: "button" | "submit";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`group inline-flex min-h-[44px] items-center justify-between gap-3 rounded-full pl-5 pr-2 py-1.5 text-sm font-medium orbital-transition active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none cursor-pointer ${
        isPrimary
          ? "bg-[#38BDF8] text-[#04060A] hover:bg-[#60CCF9]"
          : "bg-white/[0.06] text-[#F1F5F9] ring-1 ring-white/15 hover:bg-white/[0.11]"
      } ${className}`}
    >
      <span>{children}</span>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full orbital-transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105 ${
          isPrimary ? "bg-[#04060A]/15 text-[#04060A]" : "bg-white/10 text-[#38BDF8]"
        }`}
      >
        <ArrowUpRight size={16} weight="light" />
      </span>
    </button>
  );
}

export function DisclaimerBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#F59E0B]/25 bg-[#F59E0B]/[0.06] px-4 py-3 text-xs leading-relaxed text-[#CBD5E1]">
      <ShieldWarning size={18} weight="light" className="mt-0.5 shrink-0 text-[#F59E0B]" />
      <div>
        <span className="font-mono-num uppercase tracking-wider text-[#FBBF24] mr-2">
          Scientific Guardrail:
        </span>
        {text}
      </div>
    </div>
  );
}
