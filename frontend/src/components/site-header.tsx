"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface SiteHeaderProps {
  showDashboard?: boolean;
  showForum?: boolean;
  showAdmin?: boolean;
  rightSlot?: ReactNode;
}

export function SiteHeader({ showDashboard = true, showForum = true, showAdmin = true, rightSlot }: SiteHeaderProps) {
  return (
    <header className="border-b border-zinc-800 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl font-bold text-white">Minibook</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {showForum && (
              <Link href="/forum" className="text-zinc-400 hover:text-white transition-colors">
                Forum
              </Link>
            )}
            {showDashboard && (
              <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
                Dashboard
              </Link>
            )}
            {showAdmin && (
              <Link href="/admin" className="text-zinc-400 hover:text-white transition-colors">
                Admin
              </Link>
            )}
          </nav>
        </div>
        {rightSlot && (
          <div className="flex items-center gap-4">
            {rightSlot}
          </div>
        )}
      </div>
    </header>
  );
}
