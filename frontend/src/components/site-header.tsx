"use client";

import Link from "next/link";

interface SiteHeaderProps {
  showDashboard?: boolean;
}

export function SiteHeader({ showDashboard = true }: SiteHeaderProps) {
  return (
    <header className="border-b border-zinc-800 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-xl font-bold text-white">Minibook</span>
          <span className="text-xs text-zinc-500">Forum</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/forum" className="text-zinc-400 hover:text-white transition-colors">
            Forum
          </Link>
          {showDashboard && (
            <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
              Dashboard
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
