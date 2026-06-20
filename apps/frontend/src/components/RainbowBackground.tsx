"use client";

import React, { useEffect, useState } from "react";

const PEACH = "rgba(255, 139, 94, 0.15)";
const CYAN = "rgba(94, 226, 255, 0.1)";
const PURPLE = "rgba(176, 94, 255, 0.1)";

const COMBINATIONS = [
  [PEACH, CYAN, PURPLE],
  [PEACH, PURPLE, CYAN],
  [CYAN, PEACH, PURPLE],
  [CYAN, PURPLE, PEACH],
  [PURPLE, CYAN, PEACH],
  [PURPLE, PEACH, CYAN],
];

const MASK_COLOR = "#060608"; // surface-0

export default function RainbowBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const length = 25;
  const animationTime = 90; // seconds

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="relative w-full h-full blur-[10px]">
        {Array.from({ length }).map((_, idx) => {
          const i = idx + 1;
          const r = (i * 7) % 6;
          const colors = COMBINATIONS[r];
          
          // -130px 0 80px 40px MASK, -50px 0 50px 25px c1, 0 0 50px 25px c2, 50px 0 50px 25px c3, 130px 0 80px 40px MASK
          const boxShadow = `-130px 0 80px 40px ${MASK_COLOR}, -50px 0 50px 25px ${colors[0]}, 0 0 50px 25px ${colors[1]}, 50px 0 50px 25px ${colors[2]}, 130px 0 80px 40px ${MASK_COLOR}`;
          
          const duration = animationTime - (animationTime / length / 2) * i;
          const delay = -((i / length) * animationTime);

          return (
            <div
              key={i}
              className="absolute top-0 h-[100vh] w-0 rotate-[10deg] origin-top-right animate-slide-rainbow"
              style={{
                boxShadow,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
        {/* Horizontal and Vertical Masks */}
        <div 
          className="absolute bottom-0 left-0 w-[100vw] h-0"
          style={{ boxShadow: `0 0 50vh 40vh ${MASK_COLOR}` }}
        />
        <div 
          className="absolute bottom-0 left-0 w-0 h-[100vh]"
          style={{ boxShadow: `0 0 35vw 25vw ${MASK_COLOR}` }}
        />
      </div>
    </div>
  );
}
