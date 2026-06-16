"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export default function GenericDashboardPage({ title, desc }: { title: string, desc: string }) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".dash-card", {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
      });
    },
    { scope: container }
  );

  return (
    <div ref={container} className="flex flex-col gap-10">
      <div>
        <h1 className="text-4xl font-medium font-display tracking-tight text-white mb-3">{title}</h1>
        <p className="text-text-muted text-lg font-light">{desc}</p>
      </div>

      <div className="dash-card p-12 rounded-[2rem] bg-surface-1/50 backdrop-blur-xl border border-white/5 shadow-2xl flex flex-col items-center justify-center min-h-[400px] text-center">
        <h3 className="text-xl font-display font-medium text-white mb-2">Coming Soon</h3>
        <p className="text-text-muted max-w-sm font-light">This module is currently being finalized for the v1.0.4 engine release.</p>
      </div>
    </div>
  );
}
