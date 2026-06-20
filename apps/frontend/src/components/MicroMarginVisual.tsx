
"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Image from "next/image";

export default function MicroMarginVisual() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Very slow, cinematic pan and scale effect
    gsap.fromTo(".visual-image", 
      { scale: 1.05, x: -10, y: -5 },
      { scale: 1.15, x: 10, y: 5, duration: 20, ease: "sine.inOut", repeat: -1, yoyo: true }
    );
  }, { scope: container });

  return (
    <div ref={container} className="w-full h-full relative overflow-hidden bg-[#060608] rounded-[24px]">
      <Image 
        src="/images/micro_margin_routing.png" 
        alt="Micro-Margin Routing" 
        fill
        className="visual-image object-cover origin-center opacity-90"
      />
      
      {/* Subtle vignette border to blend with background */}
      <div className="absolute inset-0 z-20 shadow-[inset_0_0_40px_rgba(6,6,8,1)] pointer-events-none"></div>
    </div>
  );
}

