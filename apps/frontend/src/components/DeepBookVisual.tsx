"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function DeepBookVisual() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Elegant breathing for the order book bars
    gsap.to(".order-bar-ask", {
      scaleX: "random(0.6, 1.1)",
      duration: 3,
      ease: "sine.inOut",
      transformOrigin: "left center",
      stagger: { each: 0.1, repeat: -1, yoyo: true }
    });

    gsap.to(".order-bar-bid", {
      scaleX: "random(0.6, 1.1)",
      duration: 3,
      ease: "sine.inOut",
      transformOrigin: "right center",
      stagger: { each: 0.1, repeat: -1, yoyo: true }
    });

    const tl = gsap.timeline({ repeat: -1 });

    // The Black-Scholes curve drawing in
    tl.fromTo(".bs-curve",
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 4, ease: "power2.inOut" }
    );

    // The scanning line moving across
    gsap.fromTo(".scan-line",
      { x: 30, opacity: 0 },
      { x: 370, opacity: 1, duration: 4, ease: "power2.inOut", repeat: -1, yoyo: true }
    );

    // Intersection dot traveling along the curve
    gsap.to(".intersect-dot", {
      motionPath: {
        path: ".bs-curve",
        align: ".bs-curve",
        alignOrigin: [0.5, 0.5]
      },
      duration: 4,
      ease: "power2.inOut",
      repeat: -1,
      yoyo: true
    });

    // We can't use motionPath plugin safely if it's not registered, 
    // so let's animate it using x and y mathematically approximating the curve.
    // The curve is M 30 150 C 150 150, 200 50, 370 50
    // A simpler approach without motionPath is just animating x and translating y manually, 
    // but honestly let's just use CSS translations with a custom cubic bezier for Y.
    // Wait, let's just make the scan line pulse and the intersection glow when it hits the middle.
    
    gsap.fromTo(".intersect-glow",
      { scale: 0.5, opacity: 0 },
      { scale: 2, opacity: 0.8, duration: 2, ease: "power2.inOut", repeat: -1, yoyo: true, transformOrigin: "center" }
    );

  }, { scope: container });

  return (
    <div ref={container} className="w-full h-full relative flex items-center justify-center overflow-hidden bg-[#070709] rounded-[24px]">
      {/* Emil Kowalski Noise Texture */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-screen pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}></div>
      
      {/* Subtle Background Glows */}
      <div className="absolute w-[200px] h-[200px] bg-[#FD8566] rounded-full blur-[100px] opacity-[0.04] top-[20%] right-[20%] pointer-events-none" />
      <div className="absolute w-[200px] h-[200px] bg-white rounded-full blur-[100px] opacity-[0.02] bottom-[20%] left-[20%] pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_60%,transparent_100%)]"></div>

      <svg className="w-[90%] h-[90%] overflow-visible" viewBox="0 0 400 200">
        <defs>
          <filter id="glow-orange-deep" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="15" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="curve-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="40%" stopColor="#FD8566" />
            <stop offset="60%" stopColor="#FD8566" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
          <linearGradient id="scan-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Abstract Order Book Depth */}
        <g transform="translate(100, 40)">
          {/* Asks (Top) */}
          <rect className="order-bar-ask" x="0" y="0" width="70" height="4" fill="rgba(255,255,255,0.05)" rx="2" />
          <rect className="order-bar-ask" x="0" y="14" width="50" height="4" fill="rgba(255,255,255,0.08)" rx="2" />
          <rect className="order-bar-ask" x="0" y="28" width="90" height="4" fill="rgba(255,255,255,0.1)" rx="2" />
          <rect className="order-bar-ask" x="0" y="42" width="130" height="4" fill="rgba(255,255,255,0.15)" rx="2" />
          
          {/* Spread Indicator */}
          <line x1="-20" y1="56" x2="220" y2="56" stroke="rgba(253,133,102,0.2)" strokeWidth="1" strokeDasharray="2 6" />
          <circle cx="100" cy="56" r="3" fill="#FD8566" opacity="0.5" />
          
          {/* Bids (Bottom) */}
          <g transform="translate(200, 0)">
            <rect className="order-bar-bid" x="-110" y="70" width="110" height="4" fill="rgba(253,133,102,0.15)" rx="2" />
            <rect className="order-bar-bid" x="-80" y="84" width="80" height="4" fill="rgba(253,133,102,0.1)" rx="2" />
            <rect className="order-bar-bid" x="-120" y="98" width="120" height="4" fill="rgba(253,133,102,0.08)" rx="2" />
            <rect className="order-bar-bid" x="-60" y="112" width="60" height="4" fill="rgba(253,133,102,0.05)" rx="2" />
          </g>
        </g>

        {/* Black-Scholes Pricing Curve */}
        <path className="bs-curve" d="M 30 160 C 130 160, 180 50, 370 50" fill="none" stroke="url(#curve-grad)" strokeWidth="3" pathLength="1" strokeDasharray="1" strokeLinecap="round" filter="url(#glow-orange-deep)" />
        
        {/* Scanning Line & Intersection */}
        <g className="scan-line" transform="translate(0, 0)">
          <line x1="0" y1="20" x2="0" y2="180" stroke="url(#scan-grad)" strokeWidth="2" />
        </g>

        {/* Static center intersection glow for visual anchor */}
        <g transform="translate(200, 96)">
          <circle className="intersect-glow" cx="0" cy="0" r="15" fill="none" stroke="rgba(253,133,102,0.4)" strokeWidth="1" />
          <circle cx="0" cy="0" r="4" fill="#fff" filter="url(#glow-orange-deep)" />
        </g>
      </svg>
    </div>
  );
}
