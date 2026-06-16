"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AnimatedHeroBackground from "@/components/AnimatedHeroBackground";
import PeachTextLogo from "@/components/PeachTextLogo";
import LandingDocs from "@/components/LandingDocs";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export default function LandingPage() {
  const container = useRef<HTMLDivElement>(null);
  const textRevealRef = useRef<HTMLDivElement>(null);
  const pinSectionRef = useRef<HTMLDivElement>(null);
  const pinLeftRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useGSAP(
    () => {
      // Hero Entrance
      const tl = gsap.timeline({ delay: 0.1 });
      tl.from(".hero-line", {
        yPercent: 100,
        opacity: 0,
        duration: 1.2,
        stagger: 0.1,
        ease: "power4.out",
      })
      .from(".hero-cta", {
        y: 20,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
      }, "-=0.8");

      // Animate Inline SVG
      gsap.to(".hero-inline-svg", {
        rotation: 360,
        ease: "none",
        duration: 10,
        repeat: -1,
        transformOrigin: "50% 50%"
      });

      // Text Scrub Reveal
      if (textRevealRef.current) {
        const words = gsap.utils.toArray(".reveal-word");
        gsap.fromTo(words, 
          { opacity: 0.15 },
          {
            opacity: 1,
            stagger: 0.05,
            scrollTrigger: {
              trigger: textRevealRef.current,
              start: "top 80%",
              end: "bottom 50%",
              scrub: 1,
            }
          }
        );
      }

      // Split Pin Scroll
      let mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        if (pinSectionRef.current && pinLeftRef.current) {
          ScrollTrigger.create({
            trigger: pinSectionRef.current,
            start: "top 10%",
            end: "bottom bottom",
            pin: pinLeftRef.current,
            scrub: 1,
          });
        }
      });

      gsap.utils.toArray(".pin-card").forEach((card: any, i) => {
        gsap.fromTo(card,
          { y: 150, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 1.2,
            ease: "expo.out",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              toggleActions: "play reverse play reverse",
            }
          }
        );
      });

      // Infinite Marquee
      if (marqueeRef.current) {
        gsap.to(".marquee-inner", {
          xPercent: -50,
          ease: "none",
          duration: 25,
          repeat: -1
        });
      }

      // Bento Grid Entrance
      gsap.fromTo(".bento-item", 
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".bento-grid-container",
            start: "top 80%",
          }
        }
      );
    },
    { scope: container }
  );

  return (
    <div ref={container} className="min-h-screen flex flex-col relative bg-[#060608] overflow-x-hidden w-full max-w-full font-sans">
      <AnimatedHeroBackground />
      
      {/* Premium Floating Island Navigation */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          scrolled ? "pt-6" : "pt-8"
        }`}
      >
        <nav 
          className={`flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            scrolled
              ? "w-[92%] max-w-5xl bg-[#0a0a0c]/80 backdrop-blur-2xl px-6 py-3.5 rounded-full border border-white/[0.08] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]"
              : "w-full max-w-7xl px-8 py-2 bg-transparent border border-transparent"
          }`}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center group z-20">
            <PeachTextLogo className="h-11 w-auto group-hover:scale-105 transition-transform duration-500 origin-left drop-shadow-[0_0_15px_rgba(253,133,102,0.15)]" />
          </Link>
          
          {/* Middle Links */}
          <div className="hidden md:flex items-center gap-2 z-10 absolute left-1/2 -translate-x-1/2">
            <a href="#platform" className="text-[13px] font-medium text-[#8a8690] hover:text-white transition-all duration-300 px-5 py-2.5 rounded-full hover:bg-white/[0.04]">
              Platform
            </a>
            <a href="#infrastructure" className="text-[13px] font-medium text-[#8a8690] hover:text-white transition-all duration-300 px-5 py-2.5 rounded-full hover:bg-white/[0.04]">
              Infrastructure
            </a>
            <a href="#docs" className="text-[13px] font-medium text-[#8a8690] hover:text-white transition-all duration-300 px-5 py-2.5 rounded-full hover:bg-white/[0.04]">
              Documentation
            </a>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-6 z-20">
            <Link href="/login" className="text-[13px] font-medium text-[#8a8690] hover:text-white transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link href="/dashboard" className="group relative flex items-center justify-center text-[13px] font-medium bg-white text-black px-6 py-2.5 rounded-full hover:scale-105 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <span className="relative z-10">Dashboard</span>
              <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-500"></div>
            </Link>
          </div>
        </nav>
      </header>

      {/* Cinematic Hero */}
      <main className="flex flex-col items-center justify-center px-6 pt-[25vh] pb-48 relative z-10 min-h-[90vh]">
        <div className="w-full max-w-[90rem] mx-auto text-center relative z-20 flex flex-col items-center">
          <h1 className="text-white font-display font-medium tracking-tight leading-[1.05] mb-12 flex flex-col items-center justify-center text-[clamp(3rem,5vw,5rem)]">
            <div className="overflow-hidden pb-2"><span className="hero-line block">Volatility-Insured</span></div>
            <div className="overflow-hidden pb-4 flex items-center justify-center flex-wrap gap-4">
              <span className="hero-line block">
                Payment
                <span className="hero-inline-svg inline-flex items-center justify-center mx-4 align-middle w-[clamp(50px,6vw,80px)] h-[clamp(50px,6vw,80px)] text-[#FD8566]">
                  <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full opacity-90 drop-shadow-[0_0_15px_rgba(253,133,102,0.5)]">
                    <path d="M50 0 C 50 40, 60 50, 100 50 C 60 50, 50 60, 50 100 C 50 60, 40 50, 0 50 C 40 50, 50 40, 50 0 Z" />
                  </svg>
                </span>
                Streams.
              </span>
            </div>
          </h1>
          
          <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-6 mt-8">
            <Link href="/dashboard" className="px-10 py-5 bg-white text-black font-medium text-[15px] rounded-full transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]">
              Start Streaming
            </Link>
            <a href="#docs" className="px-10 py-5 bg-transparent border border-white/10 text-white font-medium text-[15px] rounded-full hover:bg-white/5 transition-colors duration-300">
              Read the Whitepaper
            </a>
          </div>
        </div>
      </main>

      {/* Scrub Text Reveal Section */}
      <section className="w-full max-w-5xl mx-auto px-6 py-48 relative z-10">
        <div ref={textRevealRef} className="text-[clamp(1.5rem,3vw,3rem)] font-light leading-tight tracking-tight text-white font-display text-center">
          {`We transform passive token flows into active, self-hedging assets. By seamlessly routing a 1% micro-margin into DeepBook Predict, your purchasing power remains 100% intact during market crashes.`.split(" ").map((word, i) => (
            <span key={i} className="reveal-word inline-block mr-3 mb-2">{word}</span>
          ))}
        </div>
      </section>

      {/* Infinite Marquee */}
      <section ref={marqueeRef} className="w-full overflow-hidden py-32 border-y border-white/[0.03] bg-white/[0.01] relative z-10">
        <div className="flex whitespace-nowrap w-[200%] marquee-inner">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-16 px-8 text-white/20 font-display text-[clamp(1.5rem,3vw,2.5rem)] uppercase tracking-widest font-bold">
              <span>Zero Liquidation Risk</span>
              <span className="w-4 h-4 rounded-full bg-[#FD8566]"></span>
              <span>100M+ Value Streamed</span>
              <span className="w-4 h-4 rounded-full bg-[#FD8566]"></span>
              <span>DeepBook V3 Powered</span>
              <span className="w-4 h-4 rounded-full bg-[#FD8566]"></span>
            </div>
          ))}
        </div>
      </section>

      {/* Split Pin Scroll Section */}
      <section ref={pinSectionRef} id="platform" className="max-w-7xl w-full mx-auto px-6 py-48 flex flex-col lg:flex-row gap-20 relative z-10">
        <div className="lg:w-1/3">
          <div ref={pinLeftRef} className="pt-10">
            <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-display text-white leading-[1.05] tracking-tight mb-8">
              The Mechanism.
            </h2>
            <p className="text-[#8a8690] text-xl font-light leading-relaxed max-w-sm">
              Our additive insurance model extracts micro-premiums, guaranteeing value preservation without ongoing funding fee decay.
            </p>
          </div>
        </div>
        
        <div className="lg:w-2/3 flex flex-col gap-16">
          <div className="pin-card bg-white/[0.02] border border-white/[0.05] rounded-[40px] p-12 overflow-hidden group">
            <h3 className="text-2xl text-white font-medium mb-6 font-display">1% Micro-Margin Routing</h3>
            <p className="text-[#8a8690] text-xl leading-relaxed mb-10 max-w-lg">
              99% of your payment is streamed directly to the recipient as liquid assets. 1% is algorithmically routed to the Peach module.
            </p>
            <div className="w-full h-80 rounded-[24px] bg-gradient-to-br from-[#FD8566]/10 to-transparent relative overflow-hidden flex items-center justify-center">
               <div className="absolute inset-0 bg-[#FD8566]/5 group-hover:bg-[#FD8566]/15 transition-colors duration-700" />
            </div>
          </div>
          
          <div className="pin-card bg-white/[0.02] border border-white/[0.05] rounded-[40px] p-12 overflow-hidden group">
            <h3 className="text-2xl text-white font-medium mb-6 font-display">Automated PTB Hedging</h3>
            <p className="text-[#8a8690] text-xl leading-relaxed mb-10 max-w-lg">
              Programmable Transaction Blocks (PTBs) automatically extract the premium and mint downside put contracts natively every epoch.
            </p>
            <div className="w-full h-80 rounded-[24px] bg-[#0d0d10] relative overflow-hidden">
               {/* Background visual abstract */}
               <div className="absolute inset-0 bg-white/5 opacity-50 mix-blend-screen group-hover:scale-105 transition-transform duration-1000 ease-out" />
            </div>
          </div>
          
          <div className="pin-card bg-white/[0.02] border border-white/[0.05] rounded-[40px] p-12 overflow-hidden group">
            <h3 className="text-2xl text-white font-medium mb-6 font-display">DeepBook Predict Integration</h3>
            <p className="text-[#8a8690] text-xl leading-relaxed mb-10 max-w-lg">
              We leverage DeepBook V3's capital efficiency to accurately price options via a Black-Scholes invariant, ensuring minimal spread.
            </p>
            <div className="w-full h-80 rounded-[24px] bg-gradient-to-tr from-white/5 to-transparent relative overflow-hidden">
               <div className="absolute inset-0 bg-white/[0.02] group-hover:bg-white/[0.08] transition-colors duration-700" />
            </div>
          </div>
        </div>
      </section>

      {/* Gapless Bento Grid */}
      <section id="infrastructure" className="bento-grid-container max-w-7xl w-full mx-auto px-6 py-48 relative z-10">
        <h2 className="text-center text-[clamp(2rem,4vw,3.5rem)] font-display text-white mb-24 tracking-tight">Enterprise Treasury</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 auto-rows-[340px] gap-6 grid-flow-dense">
          <div className="bento-item col-span-1 md:col-span-2 row-span-2 bg-[#0a0a0c] rounded-[40px] border border-white/[0.05] p-16 relative overflow-hidden group">
             <div className="relative z-10 h-full flex flex-col justify-end">
               <h3 className="text-3xl text-white font-medium mb-6 font-display">Macro Upside Capture</h3>
               <p className="text-[#8a8690] text-lg font-light max-w-md">While your downside is protected, you retain 100% of the upside. When the market surges, you walk away with massive net gains.</p>
             </div>
             {/* Replace missing footer_bg_v2 with abstract gradient */}
             <div className="absolute inset-0 bg-gradient-to-t from-[#FD8566]/10 to-transparent mix-blend-screen opacity-20 group-hover:opacity-40 transition-opacity duration-[1.5s]" />
          </div>
          
          <div className="bento-item col-span-1 row-span-1 bg-white/[0.02] rounded-[40px] border border-white/[0.05] p-12 flex flex-col justify-end group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-t from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <h3 className="text-xl text-white font-medium group-hover:text-[#FD8566] transition-colors duration-500 font-display">Zero Collateral</h3>
            <p className="text-[#8a8690] mt-4 font-light">Additive insurance means no liquidations.</p>
          </div>
          
          <div className="bento-item col-span-1 row-span-1 bg-[#FD8566]/5 rounded-[40px] border border-[#FD8566]/10 p-12 flex flex-col justify-end group overflow-hidden relative">
             <div className="absolute top-10 right-10 w-16 h-16 bg-[#FD8566] rounded-full blur-2xl opacity-40 group-hover:opacity-80 transition-opacity duration-700" />
            <h3 className="text-xl text-white font-medium font-display">Instant Payouts</h3>
            <p className="text-[#8a8690] mt-4 font-light">Options settle instantly to your stream wallet.</p>
          </div>
        </div>
      </section>

      <LandingDocs />

      {/* Premium Minimal Footer */}
      <footer className="w-full border-t border-white/[0.05] relative z-10 overflow-hidden">
        {/* Background Image with Smooth Top Fade */}
        <div className="absolute inset-0 z-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%)]">
          <div className="absolute inset-0 bg-gradient-to-t from-[#060608] to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-8 py-24 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-2">
              <Link href="/" className="flex items-center mb-8 group">
                <PeachTextLogo className="h-16 w-auto group-hover:scale-105 transition-transform duration-500 origin-left drop-shadow-[0_0_15px_rgba(253,133,102,0.15)]" />
              </Link>
              <p className="text-[#8a8690] font-light text-lg max-w-sm leading-relaxed">
                The enterprise standard for downside-protected payment streaming.
              </p>
            </div>
            
            <div className="flex flex-col gap-5">
              <h4 className="text-white font-medium mb-3">Protocol</h4>
              <a href="#" className="text-[#8a8690] hover:text-white transition-colors">Documentation</a>
              <a href="#" className="text-[#8a8690] hover:text-white transition-colors">Smart Contracts</a>
              <a href="#" className="text-[#8a8690] hover:text-white transition-colors">Audit Reports</a>
            </div>

            <div className="flex flex-col gap-5">
              <h4 className="text-white font-medium mb-3">Company</h4>
              <a href="#" className="text-[#8a8690] hover:text-white transition-colors">About</a>
              <a href="#" className="text-[#8a8690] hover:text-white transition-colors">Blog</a>
              <a href="#" className="text-[#8a8690] hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-24 pt-8 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-6 text-[15px] text-[#8a8690]">
            <p>© {new Date().getFullYear()} Peach Protocol. All rights reserved.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
