"use client";

import Image from "next/image";

export default function AnimatedLogo({ className = "" }: { className?: string }) {
  // We swapped the PNG back to the high-res SVG for better scaling
  // We keep the component name as AnimatedLogo so we don't have to refactor 
  // every single import in the application.
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Image
        src="/peach_logo.svg"
        alt="Peach Logo"
        width={128}
        height={128}
        className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(255,139,94,0.4)]"
        priority
      />
    </div>
  );
}
