"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoredTheme, setStoredTheme, applyTheme, type Theme } from "@/lib/theme-utils";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function toggleTheme() {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    setStoredTheme(newTheme);
    applyTheme(newTheme);
  }

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="w-8 h-8 p-0"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
