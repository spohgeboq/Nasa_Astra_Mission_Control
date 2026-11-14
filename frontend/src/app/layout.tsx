import type { Metadata } from "next";
import "./globals.css";
import { MissionShell } from "@/components/MissionShell";

export const metadata: Metadata = {
  title: "ASTRA — Autonomous Spaceflight Health Intelligence",
  description:
    "Offline-first spaceflight crew health telemetry, facial/ocular screening, cognitive monitoring, and digital twin mission simulation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-dvh flex flex-col bg-[#04060A] text-[#F1F5F9] selection:bg-[#38BDF8]/30 selection:text-white">
        <div className="orbital-backdrop" aria-hidden="true" />
        <MissionShell>{children}</MissionShell>
      </body>
    </html>
  );
}
