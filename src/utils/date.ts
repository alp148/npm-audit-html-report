/**
 * @fileoverview Date formatting utilities for filenames and display.
 */

/**
 * Format a Date as an ISO-like string safe for filenames.
 * Example: 2024-07-28T16-00-00
 * @param date - Date to format (defaults to now).
 */
export function toFileSafeIso(date: Date = new Date()): string {
  return date
    .toISOString()
    .slice(0, 19)
    .replace('T', 'T')
    .replace(/:/g, '-');
}

/**
 * Format a Date for human display in reports.
 * Example: July 28, 2024 at 16:00:00 UTC
 * @param date - Date to format (defaults to now).
 */
export function toDisplayDate(date: Date = new Date()): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Format a Date as a short date string.
 * Example: 2024-07-28
 * @param date - Date to format (defaults to now).
 */
export function toShortDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Return the current ISO timestamp string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}
