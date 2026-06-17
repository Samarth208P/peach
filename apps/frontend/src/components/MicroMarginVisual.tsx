"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function MicroMarginVisual() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Background glow slow movement
    gsap.to(".bg-glow-orb", {
      x: "random(-30, 30)",
      y: "random(-30, 30)",
      duration: 6,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    // Flowing energy routes with exact pathLength
    gsap.fromTo(".energy-main", 
      { strokeDashoffset: 1 },
      { strokeDashoffset: -1, duration: 4, ease: "power1.inOut", repeat: -1 }
    );
    
    gsap.fromTo(".energy-split", 
      { strokeDashoffset: 1 },
      { strokeDashoffset: -1, duration: 4, ease: "power1.inOut", repeat: -1 }
    );

    // Nodes pulsing
    gsap.to(".node-pulse", {
      scale: 1.6,
      opacity: 0,
      duration: 2.5,
      ease: "power2.out",
      stagger: {
        each: 1.5,
        repeat: -1
      },
      transformOrigin: "center"
    });
  }, { scope: container });

  return (
    <div ref={container} className="w-full h-full relative flex items-center justify-center overflow-hidden bg-[#070709] rounded-[24px]">
      {/* Noise Texture for Emil Kowalski look */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-screen pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}></div>
      
      {/* Background Orbs */}
      <div className="bg-glow-orb absolute w-[350px] h-[350px] bg-[#FD8566] rounded-full blur-[140px] opacity-[0.06] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="bg-glow-orb absolute w-[200px] h-[200px] bg-white rounded-full blur-[100px] opacity-[0.03] top-1/4 left-1/4 pointer-events-none" />

      {/* Ultra-subtle Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_50%,transparent_100%)]"></div>

      <svg className="w-[90%] h-[90%] overflow-visible" viewBox="0 0 400 200">
        <defs>
          <filter id="glow-orange-heavy" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="15" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-white-heavy" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="main-track" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.01)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
          </linearGradient>
          <linearGradient id="branch-track" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(253,133,102,0.25)" />
            <stop offset="100%" stopColor="rgba(253,133,102,0.02)" />
          </linearGradient>
        </defs>

        {/* Base Tracks */}
        <line x1="20" y1="90" x2="380" y2="90" stroke="url(#main-track)" strokeWidth="1.5" strokeDasharray="3 5" strokeLinecap="round" />
        <path d="M 180 90 C 180 150, 220 170, 270 170 L 320 170" fill="none" stroke="url(#branch-track)" strokeWidth="1.5" strokeDasharray="3 5" strokeLinecap="round" />

        {/* Animated flow routes using pathLength for exact percentage morphing */}
        <line className="energy-main" x1="20" y1="90" x2="380" y2="90" fill="none" stroke="#FD8566" strokeWidth="4" strokeLinecap="round" filter="url(#glow-orange)" pathLength="1" strokeDasharray="0.2 0.8" />
        <path className="energy-split" d="M 180 90 C 180 150, 220 170, 270 170 L 320 170" fill="none" stroke="#FD8566" strokeWidth="3" strokeLinecap="round" filter="url(#glow-orange)" pathLength="1" strokeDasharray="0.1 0.9" />

        {/* Origin Node */}
        <g transform="translate(20, 90)">
          <circle cx="0" cy="0" r="10" fill="#000" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <circle cx="0" cy="0" r="3" fill="rgba(255,255,255,0.3)" />
        </g>

        {/* Split Intersection Node */}
        <g transform="translate(180, 90)">
          <circle cx="0" cy="0" r="16" fill="#050505" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <circle cx="0" cy="0" r="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <circle cx="0" cy="0" r="3" fill="#fff" filter="url(#glow-white-heavy)" />
        </g>

        {/* Main Destination Node */}
        <g transform="translate(380, 90)">
          <circle className="node-pulse" cx="0" cy="0" r="14" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          <circle cx="0" cy="0" r="18" fill="#050505" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <circle cx="0" cy="0" r="6" fill="#fff" filter="url(#glow-white-heavy)" />
          <text x="0" y="-28" fill="rgba(255,255,255,0.7)" fontSize="9" fontWeight="600" textAnchor="middle" className="font-display tracking-[0.25em]">99% YIELD</text>
        </g>

        {/* Micro Destination Node */}
        <g transform="translate(320, 170)">
          <circle className="node-pulse" cx="0" cy="0" r="14" fill="none" stroke="rgba(253,133,102,0.5)" strokeWidth="1" />
          <circle cx="0" cy="0" r="18" fill="#050505" stroke="rgba(253,133,102,0.2)" strokeWidth="1" />
          <circle cx="0" cy="0" r="6" fill="#FD8566" filter="url(#glow-orange-heavy)" />
          <text x="0" y="30" fill="rgba(253,133,102,0.9)" fontSize="9" fontWeight="600" textAnchor="middle" className="font-display tracking-[0.25em]">1% HEDGE</text>
        </g>
      </svg>
    </div>
  );
}
