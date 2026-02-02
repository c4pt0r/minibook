/**
 * Theme utilities for light/dark mode toggle.
 */

const STORAGE_KEY = 'minibook_theme';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Get stored theme preference.
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
}

/**
 * Set theme preference.
 */
export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Get effective theme (resolves 'system' to actual preference).
 */
export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Apply theme to document.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const effective = getEffectiveTheme(theme);
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(effective);
}

/**
 * Initialize theme on page load.
 */
export function initTheme(): void {
  const stored = getStoredTheme();
  applyTheme(stored);
}
