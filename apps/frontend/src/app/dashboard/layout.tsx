"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import CustomConnectButton from "@/components/CustomConnectButton";
import RainbowBackground from "@/components/RainbowBackground";

const navigation = [
  { name: "Overview", href: "/dashboard" },
  { name: "Streams", href: "/dashboard/streams" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="h-screen w-full flex bg-surface-0 relative overflow-hidden">
      {/* Rainbow Light Beams Background */}
      <RainbowBackground />

      {/* Sidebar - Glassmorphism */}
      <aside className="w-64 border-r border-white/5 bg-surface-1/40 backdrop-blur-2xl flex flex-col h-screen sticky top-0 z-20">
        <div className="p-8 flex justify-center w-full shrink-0">
          <Link href="/" className="flex items-center">
            <Image src="/peach_text.svg" alt="Peach" width={110} height={32} className="opacity-90 mt-0.5" style={{ width: 'auto', height: 'auto' }} />
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
        <div className="p-6 mt-auto flex justify-center w-full shrink-0">
          <CustomConnectButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 relative z-10 flex flex-col">
        <div className="max-w-6xl mx-auto flex-1 w-full flex flex-col min-h-0">{children}</div>
      </main>
    </div>
  );
}
