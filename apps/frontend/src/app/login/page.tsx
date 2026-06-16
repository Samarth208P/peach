"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import PeachTextLogo from "@/components/PeachTextLogo";

export default function LoginPage() {
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const handleZkLogin = (provider: string) => {
    // Placeholder for Enoki SDK routing
    console.log(`Routing to Enoki zkLogin flow for ${provider}...`);
    // Simulate auth and redirect
    router.push("/dashboard");
  };

  const handleWalletConnect = () => {
    // Placeholder for Sui dApp Kit Wallet Connection
    console.log("Opening standard Web3 wallet modal...");
    router.push("/dashboard");
  };

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

          <div className="flex flex-col gap-4 auth-item">
            <button 
              onClick={() => handleZkLogin('Google')}
              className="group relative flex items-center justify-center w-full bg-white text-black rounded-2xl p-4 font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
              <div className="absolute inset-0 rounded-2xl bg-[#FD8566] mix-blend-screen opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            </button>

            <button 
              onClick={() => handleZkLogin('Apple')}
              className="group relative flex items-center justify-center w-full bg-white/[0.04] border border-white/[0.08] text-white rounded-2xl p-4 font-medium transition-all duration-300 hover:bg-white/[0.08]"
            >
              <svg className="w-5 h-5 mr-3 fill-current" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.81 3.59-.83 1.5-.02 2.7.53 3.55 1.35-3.05 1.76-2.58 5.75.31 6.84-1.05 2.15-2 4.19-2.53 4.81zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.39-1.93 4.27-3.74 4.25z"/>
              </svg>
              <span>Continue with Apple</span>
            </button>
          </div>

          <div className="flex items-center gap-4 my-8 auth-item">
            <div className="flex-1 h-px bg-white/[0.05]"></div>
            <span className="text-[#8a8690] text-xs font-medium uppercase tracking-widest">OR</span>
            <div className="flex-1 h-px bg-white/[0.05]"></div>
          </div>

          <div className="auth-item">
            <button 
              onClick={handleWalletConnect}
              className="flex items-center justify-center w-full bg-transparent border border-[#FD8566]/20 text-[#FD8566] rounded-2xl p-4 font-medium transition-all duration-300 hover:bg-[#FD8566]/10"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>Connect Web3 Wallet</span>
            </button>
            <p className="text-center text-[#8a8690] text-xs mt-4">
              Standard fallback for developers & judges
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
