import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SuiProvider } from "@/components/SuiProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Peach",
  description:
    "Volatility-Insured Payment Streaming Layer. Automated risk management powered by DeepBook V3 Predict.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} dark`}
    >
      <body className="min-h-dvh bg-[#060608] text-[#e8e4df] antialiased font-sans selection:bg-peach/30 selection:text-white">
        <SuiProvider>
          {children}
        </SuiProvider>
      </body>
    </html>
  );
}
