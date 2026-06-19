"use client";

import { useState, useRef, useEffect } from "react";
import { useCurrentAccount, useDisconnectWallet, ConnectModal } from "@mysten/dapp-kit";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, ChevronDown, Wallet } from "lucide-react";

export default function CustomConnectButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!account) {
    return (
      <ConnectModal
        trigger={
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/5 text-sm font-medium text-white transition-colors w-full justify-center"
          >
            <Wallet size={16} className="text-[#FF8B5E]" />
            Connect Wallet
          </motion.button>
        }
      />
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center justify-between w-full p-2 pr-4 rounded-2xl bg-white/5 border border-white/5 text-sm font-medium text-white transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF8B5E]/50 to-[#FF8B5E] flex items-center justify-center text-xs text-surface-0 shadow-inner">
            <Wallet size={14} />
          </div>
          <span className="tracking-wide font-mono text-sm">{formatAddress(account.address)}</span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          <ChevronDown size={14} className="text-text-muted" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute bottom-[calc(100%+12px)] left-0 w-full p-2 rounded-2xl bg-[#0d0d10]/95 backdrop-blur-2xl border border-white/10 shadow-2xl z-50 overflow-hidden"
          >
            <motion.button
              whileHover={{ backgroundColor: "rgba(255,139,94,0.1)", color: "#FF8B5E" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                disconnect();
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-text-primary transition-colors text-left"
            >
              <LogOut size={16} />
              Disconnect Wallet
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
