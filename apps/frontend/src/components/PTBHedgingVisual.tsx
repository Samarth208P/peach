"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function PTBHedgingVisual() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Continuous rotation of core rings
    gsap.to(".core-ring-1", { rotation: 360, duration: 20, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
    gsap.to(".core-ring-2", { rotation: -360, duration: 15, ease: "none", repeat: -1, transformOrigin: "50% 50%" });

    const tl = gsap.timeline({ repeat: -1 });

    // Block enters
    tl.fromTo(".ptb-block", 
      { x: -150, opacity: 0, scale: 0.8 },
      { x: 200, opacity: 1, scale: 1, duration: 1.5, ease: "back.out(1.2)" }
    );

    // Extraction processing & shield building
    tl.to(".core-pulse", { scale: 1.8, opacity: 0, duration: 1, ease: "power2.out", transformOrigin: "center" }, "+=0.2");
    
    // Shield lines draw in smoothly
    tl.fromTo(".shield-outline",
      { strokeDashoffset: 1, opacity: 0 },
      { strokeDashoffset: 0, opacity: 1, duration: 1.5, ease: "power3.inOut" },
      "-=0.8"
    );
    tl.to(".shield-fill", { opacity: 0.15, duration: 1, ease: "power2.inOut" }, "-=0.5");

    // Hold and pulse
    tl.to(".shield-fill", { opacity: 0.25, duration: 0.5, ease: "power1.inOut", yoyo: true, repeat: 1 });

    // Block & shield exit
    tl.to(".ptb-block, .shield-group", {
      x: 550,
      opacity: 0,
      scale: 0.9,
      duration: 1.2,
      ease: "power2.in"
    }, "+=0.5");

  }, { scope: container });

  return (
    <div ref={container} className="w-full h-full relative flex items-center justify-center overflow-hidden bg-[#050507] rounded-[24px]">
      {/* Noise Texture */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-screen pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}></div>

      {/* Center Glow */}
      <div className="absolute w-[300px] h-[300px] bg-[#FD8566] rounded-full blur-[150px] opacity-[0.05] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_50%,transparent_100%)]"></div>

      <svg className="w-[100%] h-[100%] overflow-visible" viewBox="0 0 400 200">
        <defs>
          <filter id="glow-orange-ptb" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="15" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="shield-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FD8566" />
            <stop offset="100%" stopColor="rgba(253,133,102,0)" />
          </linearGradient>
        </defs>

        {/* Center Processing Station Base */}
        <g transform="translate(200, 100)">
          <circle className="core-ring-1" cx="0" cy="0" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="10 5" />
          <circle className="core-ring-2" cx="0" cy="0" r="55" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="2 8" />
          <circle cx="0" cy="0" r="30" fill="#000" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <circle className="core-pulse" cx="0" cy="0" r="30" fill="none" stroke="rgba(253,133,102,0.4)" strokeWidth="1" />
        </g>

        {/* Dynamic Shield Layer */}
        <g className="shield-group" transform="translate(200, 100)">
          <path className="shield-fill opacity-0" d="M 0 -40 L 35 -20 L 35 25 C 35 45, 15 65, 0 75 C -15 65, -35 45, -35 25 L -35 -20 Z" fill="url(#shield-grad)" />
          <path className="shield-outline" d="M 0 -40 L 35 -20 L 35 25 C 35 45, 15 65, 0 75 C -15 65, -35 45, -35 25 L -35 -20 Z" fill="none" stroke="#FD8566" strokeWidth="2.5" pathLength="1" strokeDasharray="1" strokeLinecap="round" filter="url(#glow-orange-ptb)" />
        </g>

        {/* The PTB Block itself */}
        <g className="ptb-block" transform="translate(200, 100)">
          {/* Inner data block */}
          <rect x="-12" y="-12" width="24" height="24" rx="4" fill="#111" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#fff" filter="url(#glow-orange-ptb)" opacity="0.8" />
          {/* Connecting data lines on block */}
          <line x1="-12" y1="0" x2="-20" y2="0" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="0" x2="20" y2="0" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
