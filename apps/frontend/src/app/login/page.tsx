"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import PeachTextLogo from "@/components/PeachTextLogo";
import { useConnectWallet, useWallets, useCurrentAccount } from '@mysten/dapp-kit';

export default function LoginPage() {
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();
  const currentAccount = useCurrentAccount();

  useEffect(() => {
    if (currentAccount) {
      router.push("/dashboard");
    }
  }, [currentAccount, router]);

  useGSAP(() => {
    gsap.fromTo(".auth-box", 
      { y: 30, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }
    );
    gsap.fromTo(".auth-item",
      { y: 15, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: "power2.out", delay: 0.2 }
    );
  }, { scope: container });

  return (
    <div ref={container} className="min-h-screen bg-[#060608] flex flex-col relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FD8566]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full p-8 flex justify-between items-center relative z-10">
        <Link href="/" className="group">
          <PeachTextLogo className="h-10 w-auto group-hover:scale-105 transition-transform duration-500 origin-left drop-shadow-[0_0_15px_rgba(253,133,102,0.15)]" />
        </Link>
        <Link href="/" className="text-[#8a8690] hover:text-white transition-colors text-sm font-medium">
          Back to Home
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="auth-box w-full max-w-[440px] bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/[0.08] rounded-[32px] p-10 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)] flex flex-col">
          
          <div className="text-center mb-10 auth-item">
            <h1 className="text-3xl text-white font-display font-medium tracking-tight mb-3">Welcome to Peach</h1>
            <p className="text-[#8a8690] font-light">Sign in to manage your protected streams.</p>
          </div>

          <div className="flex flex-col gap-3 auth-item w-full">
            {wallets.length === 0 ? (
              <div className="text-center text-[#8a8690] p-4 border border-white/5 rounded-2xl bg-white/[0.02]">
                No Sui wallets installed. Please install a wallet (like Sui Wallet or Suiet) to continue.
              </div>
            ) : (
              wallets.map((wallet) => (
                <button 
                  key={wallet.name}
                  onClick={() => connect({ wallet })}
                  className="group relative flex items-center justify-center w-full bg-white/[0.04] border border-white/[0.08] text-white rounded-2xl p-4 font-medium transition-all duration-300 hover:bg-[#FD8566]/10 hover:border-[#FD8566]/30 hover:text-[#FD8566]"
                >
                  <img src={wallet.icon} alt={wallet.name} className="w-5 h-5 mr-3 opacity-80 group-hover:opacity-100 transition-opacity" />
                  <span>{wallet.name}</span>
                </button>
              ))
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
