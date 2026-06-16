"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PeachTextLogo from "@/components/PeachTextLogo";
import LandingDocs from "@/components/LandingDocs";
import AnimatedHeroBackground from "@/components/AnimatedHeroBackground";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#060608] flex flex-col font-sans relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatedHeroBackground />
      </div>

      <header className="w-full border-b border-white/[0.05] bg-[#0a0a0c]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl w-full mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[#8a8690] hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <Link href="/" className="group">
              <PeachTextLogo className="h-7 w-auto drop-shadow-[0_0_10px_rgba(253,133,102,0.1)] group-hover:scale-105 transition-transform duration-300 origin-left" />
            </Link>
          </div>
          <div className="text-sm text-white/50 font-mono tracking-widest uppercase">
            Protocol Whitepaper
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto pb-24 relative z-10">
        {/* We reuse the existing LandingDocs component since it contains all the maths and stats */}
        <LandingDocs />
      </main>
    </div>
  );
}
