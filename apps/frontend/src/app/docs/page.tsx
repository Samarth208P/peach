"use client";

import React from "react";
import Link from "next/link";
import LandingDocs from "@/components/LandingDocs";
import AnimatedHeroBackground from "@/components/AnimatedHeroBackground";
import Header from "@/components/Header";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#060608] flex flex-col font-sans relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatedHeroBackground />
      </div>

      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto pb-24 relative z-10">
        {/* We reuse the existing LandingDocs component since it contains all the maths and stats */}
        <LandingDocs />
      </main>
    </div>
  );
}
