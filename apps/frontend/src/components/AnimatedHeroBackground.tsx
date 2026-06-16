"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";

export default function AnimatedHeroBackground() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Vowen.ai style slow aurora / mesh rotation
      // Instead of floating randomly, we smoothly rotate and slightly scale giant blurred ellipses
      gsap.to(".aurora-1", {
        rotation: 360,
        scale: 1.1,
        duration: 25,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        transformOrigin: "center center",
      });

      gsap.to(".aurora-2", {
        rotation: -360,
        scale: 1.2,
        duration: 30,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        transformOrigin: "40% 60%",
      });
      
      // Fade in the background smoothly on mount
      gsap.fromTo(container.current, { opacity: 0 }, { opacity: 1, duration: 2, ease: "power2.out" });
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={container} className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-surface-0">
      
      {/* Vowen.ai style Aurora Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vh] max-w-[1400px] opacity-60">
        <div className="aurora-1 absolute top-[10%] left-[20%] w-[60%] h-[60%] bg-peach/10 rounded-[100%] blur-[120px]" />
        <div className="aurora-2 absolute top-[30%] right-[10%] w-[50%] h-[70%] bg-white/5 rounded-[100%] blur-[100px]" />
        <div className="aurora-1 absolute bottom-[10%] left-[30%] w-[70%] h-[50%] bg-peach-light/5 rounded-[100%] blur-[140px]" />
      </div>

      {/* Heavy Premium Grain / Noise Overlay to eliminate banding and look like film */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />
      
      {/* Vignette to darken edges */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#060608_100%)] opacity-80" />
    </div>
  );
}
