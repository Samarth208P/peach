"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PeachTextLogo from "@/components/PeachTextLogo";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-[100] flex justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        scrolled ? "pt-6" : "pt-8"
      }`}
    >
      <nav 
        className={`flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          scrolled
            ? "w-[92%] max-w-5xl bg-[#0a0a0c]/80 backdrop-blur-2xl px-6 py-3.5 rounded-full border border-white/[0.08] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]"
            : "w-full max-w-7xl px-8 py-2 bg-transparent border border-transparent"
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center group z-20">
          <PeachTextLogo className="h-11 w-auto group-hover:scale-105 transition-transform duration-500 origin-left drop-shadow-[0_0_15px_rgba(253,133,102,0.15)]" />
        </Link>
        
        {/* Middle Links */}
        <div className="hidden md:flex items-center gap-2 z-10 absolute left-1/2 -translate-x-1/2">
          <Link href="/#platform" className="text-[13px] font-medium text-[#8a8690] hover:text-white transition-all duration-300 px-5 py-2.5 rounded-full hover:bg-white/[0.04]">
            Platform
          </Link>
          <Link href="/#infrastructure" className="text-[13px] font-medium text-[#8a8690] hover:text-white transition-all duration-300 px-5 py-2.5 rounded-full hover:bg-white/[0.04]">
            Infrastructure
          </Link>
          <Link href="/docs" className="text-[13px] font-medium text-[#8a8690] hover:text-white transition-all duration-300 px-5 py-2.5 rounded-full hover:bg-white/[0.04]">
            Documentation
          </Link>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-6 z-20">
          <Link href="/dashboard" className="group relative flex items-center justify-center text-[13px] font-medium bg-white text-black px-6 py-2.5 rounded-full hover:scale-105 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
            <span className="relative z-10">Dashboard</span>
            <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-500"></div>
          </Link>
        </div>
      </nav>
    </header>
  );
}
