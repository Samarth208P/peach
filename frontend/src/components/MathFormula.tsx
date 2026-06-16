"use client";

import React from "react";
import "katex/dist/katex.min.css";
import Latex from "react-latex-next";

export default function MathFormula({ math, block = false, className = "" }: { math: string; block?: boolean; className?: string }) {
  const content = block ? `$$${math}$$` : `$${math}$`;
  return (
    <span className={`${block ? "block text-center w-full my-4 text-xl" : "inline"} ${className}`}>
      <Latex strict={false}>{content}</Latex>
    </span>
  );
}
