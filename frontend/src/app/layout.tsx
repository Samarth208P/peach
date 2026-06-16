import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

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
  title: "Peach - Ticketing Infrastructure, Reimagined",
  description:
    "Headless API-first ticketing infrastructure with NFT-backed ownership, anti-scalping enforcement, and automated resale royalties for platforms like BookMyShow.",
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
        {children}
      </body>
    </html>
  );
}
