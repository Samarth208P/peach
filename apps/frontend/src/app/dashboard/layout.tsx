"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import AnimatedLogo from "@/components/AnimatedLogo";

const navigation = [
  { name: "Overview", href: "/dashboard" },
  { name: "Streams", href: "/dashboard/streams" },
  { name: "Insurance", href: "/dashboard/insurance" },
  { name: "Treasury", href: "/dashboard/treasury" },
  { name: "History", href: "/dashboard/history" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-surface-0 relative overflow-hidden">
      {/* Background ambient glow for the dashboard */}
      <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-peach/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Sidebar - Glassmorphism */}
      <aside className="w-64 border-r border-white/5 bg-surface-1/40 backdrop-blur-2xl flex flex-col h-screen sticky top-0 z-20">
        <div className="p-8 flex justify-center w-full">
          <Link href="/" className="flex items-center">
            <Image src="/peach_text.svg" alt="Peach" width={110} height={32} className="opacity-90 mt-0.5" />
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 mt-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-2.5 text-sm rounded-xl transition-all duration-300 ${
                  isActive
                    ? "bg-white/10 text-white font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    : "text-text-muted hover:text-white hover:bg-white/5"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Minimal Premium Profile Section */}
        <div className="p-6 mt-auto">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FF8B5E]/50 to-[#FF8B5E] flex items-center justify-center text-xs font-medium text-surface-0 shadow-inner">
              AC
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">Acme Corp</span>
              <span className="text-xs text-text-muted">Production Treasury</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-10 relative z-10">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
