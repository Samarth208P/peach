"use client";

import React, { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { ChevronDown, Coins, Gem, CircleDollarSign } from "lucide-react";

export interface Option {
  id: string;
  name: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
}

const getIconForAsset = (id: string) => {
  if (id.includes("XAU")) return <img src="/icons/gold_icon.png" alt="Gold" className="w-5 h-5 rounded-[4px]" />;
  if (id.includes("XAG")) return <img src="/icons/silver_icon.png" alt="Silver" className="w-5 h-5 rounded-[4px]" />;
  if (id.includes("XCU")) return <img src="/icons/copper_icon.png" alt="Copper" className="w-5 h-5 rounded-[4px]" />;
  if (id.includes("XPT")) return <img src="/icons/platinum_icon.png" alt="Platinum" className="w-5 h-5 rounded-[4px]" />;
  return <img src="https://cryptologos.cc/logos/sui-sui-logo.svg?v=032" alt="Sui" className="w-5 h-5" />;
};

export default function CustomSelect({ value, onChange, options }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    if (isOpen) {
      gsap.fromTo(
        menuRef.current,
        { opacity: 0, y: -10, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power3.out", display: "block" }
      );
    } else {
      gsap.to(menuRef.current, {
        opacity: 0,
        y: -10,
        scale: 0.95,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          if (menuRef.current) menuRef.current.style.display = "none";
        },
      });
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#060608]/50 border border-white/[0.08] hover:border-white/[0.15] rounded-2xl px-5 py-3.5 text-[#e8e4df] focus:outline-none focus:border-[#FF8B5E]/50 focus:ring-1 focus:ring-[#FF8B5E]/30 transition-all duration-300 font-mono text-sm flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {getIconForAsset(selectedOption.id)}
          <span>{selectedOption.name}</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-[#8a8690] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <div
        ref={menuRef}
        style={{ display: "none" }}
        className="absolute z-50 w-full mt-2 bg-[#0d0d10] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              onChange(option.id);
              setIsOpen(false);
            }}
            className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors duration-200 ${
              value === option.id ? "bg-white/10 text-white" : "text-[#8a8690] hover:bg-white/5 hover:text-white"
            }`}
          >
            {getIconForAsset(option.id)}
            <span className="font-mono text-sm">{option.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
