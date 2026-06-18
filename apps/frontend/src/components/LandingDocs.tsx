"use client";

import React, { useRef } from "react";
import MathFormula from "./MathFormula";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import mermaid from "mermaid";

export default function LandingDocs() {
  const container = useRef<HTMLDivElement>(null);
  const [mermaidSvg, setMermaidSvg] = React.useState<string>("");

  useGSAP(() => {
    gsap.fromTo(".doc-block", 
      { y: 50, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: container.current,
          start: "top 75%",
        }
      }
    );
  }, { scope: container });

  React.useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    const graphDef = `flowchart TD
    A[Market Volatility Spikes] --> B[OracleSVI Increases Option Premium]
    B --> C[Peach Adjusts Insurance Coverage Dynamically]
    C --> D[Standard: 1% premium = 100% Downside Protected]
    C --> E[Extreme: 1% premium = 85% Bounded Downside Floor]`;
    
    mermaid.render('mermaid-chart-svg', graphDef).then(({ svg }) => {
      setMermaidSvg(svg);
    }).catch(console.error);
  }, []);

  return (
    <section id="docs" ref={container} className="max-w-7xl w-full mx-auto px-6 py-32 relative z-10 border-t border-white/[0.05]">
      <div className="flex flex-col md:flex-row gap-16">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-1/4">
          <div className="sticky top-32 doc-block">
            <h2 className="text-3xl font-display text-white mb-6 tracking-tight">Whitepaper</h2>
            <div className="flex flex-col gap-4 text-[15px] text-[#8a8690]">
              <a href="#inbound-flow" className="hover:text-white transition-colors">1. Inbound Flow Architecture</a>
              <a href="#option-pricing" className="hover:text-white transition-colors">2. On-Chain Option Pricing</a>
              <a href="#simulation" className="hover:text-white transition-colors">3. Statistical Simulation</a>
              <a href="#system-stability" className="hover:text-white transition-colors">4. Volatility Surge Exception</a>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="w-full md:w-3/4 flex flex-col gap-24">
          
          <div id="inbound-flow" className="doc-block">
            <h3 className="text-2xl text-white font-medium mb-6 font-display">1. The Inbound Flow Architecture (Micro-Allocation)</h3>
            <p className="text-[#8a8690] text-lg leading-relaxed mb-6">
              Instead of forcing users to think about trading schedules, Peach converts a standard linear time-locked payment stream into a dynamic hedging matrix. Let the total stream contract be <MathFormula math="V = \\$50,000" /> worth of an asset (e.g., SUI) distributed continuously over time <MathFormula math="T" /> (30 days). The stream velocity (<MathFormula math="v" />) is defined as:
            </p>
            <div className="bg-white/[0.02] border border-white/[0.05] p-8 rounded-[24px] mb-6 flex justify-center">
              <MathFormula block math="v = \frac{V}{T} \approx \$1,666.66 \text{ per day} \approx \$1.15 \text{ per minute}" />
            </div>
            <p className="text-[#8a8690] text-lg leading-relaxed">
              Every hour, a Programmable Transaction Block (PTB) splits the accumulated value into a 99% Liquid Stream and a 1% Insurance Premium:
            </p>
            <ul className="list-disc pl-6 text-[#8a8690] text-lg mt-4 space-y-2">
              <li><strong className="text-white font-medium">Liquid Flow to Receiver Account:</strong> $1,650.00 / day</li>
              <li><strong className="text-white font-medium">Hedge Premium to DeepBook Predict Module:</strong> $16.66 / day</li>
            </ul>
          </div>

          <div id="option-pricing" className="doc-block">
            <h3 className="text-2xl text-white font-medium mb-6 font-display">2. On-Chain Option Pricing Mechanics</h3>
            <p className="text-[#8a8690] text-lg leading-relaxed mb-6">
              The 1% premium (<MathFormula math="S_{premium} = \\$16.66" />) is not random. Peach pulls real-time implied volatility matrices from the native DeepBook V3 OracleSVI object. This feeds automated Black-Scholes-Merton parameters straight into the contract:
            </p>
            <div className="bg-white/[0.02] border border-white/[0.05] p-8 rounded-[24px] mb-6 flex flex-col items-center justify-center gap-6">
              <MathFormula block math="d_1 = \frac{\ln(S/K) + (r + \sigma^2/2)t}{\sigma\sqrt{t}}, \quad d_2 = d_1 - \sigma\sqrt{t}" />
              <MathFormula block math="\text{Put Premium } (P) = K e^{-rt} N(-d_2) - S N(-d_1)" />
            </div>
            <p className="text-[#8a8690] text-lg leading-relaxed">
              Because Peach targets the underlying DeepBook Predict Vertical Range or binary options layer, it continuously purchases a downside contract with an at-the-money (ATM) strike price <MathFormula math="K" /> equal to the current spot price <MathFormula math="S" /> at that specific hour.
            </p>
          </div>

          <div id="simulation" className="doc-block">
            <h3 className="text-2xl text-white font-medium mb-6 font-display">3. Comprehensive Statistical Simulation Matrix</h3>
            <p className="text-[#8a8690] text-lg leading-relaxed mb-8">
              The table below breaks down the exact capital return profile of Peach under three historical macroeconomic probability scenarios for a high-volatility crypto asset. (<MathFormula math="V = \\$50,000" />, Premium <MathFormula math="\alpha = 1\%" />)
            </p>
            
            <div className="w-full overflow-x-auto mb-12">
              <table className="w-full text-left text-[#8a8690]">
                <thead>
                  <tr className="border-b border-white/[0.1] text-white">
                    <th className="py-4 px-4 font-medium">Market Trend</th>
                    <th className="py-4 px-4 font-medium">Probability</th>
                    <th className="py-4 px-4 font-medium">Spot Shift</th>
                    <th className="py-4 px-4 font-medium">Payout</th>
                    <th className="py-4 px-4 font-medium">Premium Lost</th>
                    <th className="py-4 px-4 font-medium text-right">Net Realized</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  <tr>
                    <td className="py-4 px-4 text-[#FD8566]">Severe Downturn (Bear)</td>
                    <td className="py-4 px-4">25%</td>
                    <td className="py-4 px-4">-40%</td>
                    <td className="py-4 px-4">+$19,500</td>
                    <td className="py-4 px-4">-$500</td>
                    <td className="py-4 px-4 text-right text-white font-medium">$49,500</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 text-white">Stable Consolidation (Flat)</td>
                    <td className="py-4 px-4">50%</td>
                    <td className="py-4 px-4">0%</td>
                    <td className="py-4 px-4">$0</td>
                    <td className="py-4 px-4">-$500</td>
                    <td className="py-4 px-4 text-right text-white font-medium">$49,500</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 text-green-400">Aggressive Breakout (Bull)</td>
                    <td className="py-4 px-4">25%</td>
                    <td className="py-4 px-4">+40%</td>
                    <td className="py-4 px-4">$0</td>
                    <td className="py-4 px-4">-$500</td>
                    <td className="py-4 px-4 text-right text-white font-medium">$69,500</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-xl text-white font-medium mb-4 font-display">The Mathematical Expected Value (<MathFormula math="E[V]" />)</h4>
            <div className="bg-white/[0.02] border border-white/[0.05] p-8 rounded-[24px] mb-6 flex flex-col items-center justify-center gap-6">
              <MathFormula block math="E[V_{net}] = \sum (V_{scenario} \times \text{Probability})" />
              <MathFormula block math="E[V_{net}] = (49,500 \times 0.25) + (49,500 \times 0.50) + (69,500 \times 0.25) = \mathbf{\$54,500}" />
            </div>
            
            <div className="p-6 rounded-[24px] bg-[#FD8566]/10 border border-[#FD8566]/20">
              <p className="text-[#FD8566] text-lg font-medium">
                Peach guarantees a minimum capital floor of $49,500 under any market collapse, while boasting an Expected Value of $54,500. It yields better protection than stablecoins in a up-market and infinitely better protection than raw tokens in a down-market.
              </p>
            </div>
          </div>

          <div id="system-stability" className="doc-block">
            <h3 className="text-2xl text-white font-medium mb-6 font-display">4. System Stability: The Volatility Surge Exception</h3>
            <p className="text-[#8a8690] text-lg leading-relaxed mb-6">
              A major concern is a high-velocity market crash (where implied volatility <MathFormula math="\sigma" /> doubles instantly). Peach maintains a static risk tolerance profile: it never increases the 1% micro-allocation fee. Instead, if premium costs double, Peach&apos;s internal algorithm scales back the downside range position proportionally.
            </p>
            
            <div className="bg-[#0a0a0c] p-8 rounded-[24px] border border-white/[0.05] flex justify-center overflow-x-auto min-h-[300px] items-center">
              {mermaidSvg ? (
                <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
              ) : (
                <span className="text-[#8a8690]">Loading Chart...</span>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
