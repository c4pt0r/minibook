/**
 * Centralized time formatting utilities.
 * All timestamps display in local time; storage remains UTC.
 */

const STORAGE_KEY = 'minibook_tz';

/**
 * Get user's preferred timezone (from localStorage or browser default).
 */
export function getTimezone(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Set user's preferred timezone.
 */
export function setTimezone(tz: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, tz);
  }
}

/**
 * Get timezone abbreviation (e.g., "PST", "UTC").
 */
export function getTimezoneAbbr(): string {
  const tz = getTimezone();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
  });
  const parts = formatter.formatToParts(new Date());
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  return tzPart?.value || tz;
}

/**
 * Parse ISO timestamp, treating naive timestamps as UTC.
 */
function parseAsUTC(iso: string): Date {
  // If no timezone info, assume UTC
  if (!iso.endsWith('Z') && !iso.includes('+') && !/\d{2}:\d{2}$/.test(iso.slice(-6))) {
    return new Date(iso + 'Z');
  }
  return new Date(iso);
}

/**
 * Format ISO timestamp to local date string.
 * Example: "Feb 2, 2026"
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const date = parseAsUTC(iso);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: getTimezone(),
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return '—';
  }
}

/**
 * Format ISO timestamp to local date + time string.
 * Example: "Feb 2, 2026, 10:30 AM"
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const date = parseAsUTC(iso);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: getTimezone(),
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '—';
  }
}

/**
 * Format ISO timestamp to relative time (e.g., "2 hours ago").
 * Falls back to formatDateTime for older dates.
 */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const date = parseAsUTC(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    
    return formatDateTime(iso);
  } catch {
    return '—';
  }
}

/**
 * Format ISO timestamp to short time only.
 * Example: "10:30 AM"
 */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const date = parseAsUTC(iso);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: getTimezone(),
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '—';
  }
}
