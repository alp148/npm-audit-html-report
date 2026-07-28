/**
 * @fileoverview Severity ordering, color mapping, and label helpers.
 */

import type { Severity } from '../models/audit.js';

/** Ordered list of severities from most to least severe. */
export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'moderate', 'low', 'info'];

/** CSS class names for each severity level. */
export const SEVERITY_CSS_CLASS: Record<Severity, string> = {
  critical: 'severity-critical',
  high: 'severity-high',
  moderate: 'severity-moderate',
  low: 'severity-low',
  info: 'severity-info',
};

/** Hex color values for Chart.js charts. */
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  moderate: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
};

/** Background color variants (semi-transparent for chart backgrounds). */
export const SEVERITY_BG_COLORS: Record<Severity, string> = {
  critical: 'rgba(239, 68, 68, 0.15)',
  high: 'rgba(249, 115, 22, 0.15)',
  moderate: 'rgba(234, 179, 8, 0.15)',
  low: 'rgba(59, 130, 246, 0.15)',
  info: 'rgba(107, 114, 128, 0.15)',
};

/** Emoji icons for each severity. */
export const SEVERITY_ICONS: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  moderate: '🟡',
  low: '🔵',
  info: '⚪',
};

/**
 * Return a numeric sort weight for a severity (lower = more severe).
 * @param severity - The severity to weight.
 */
export function severityWeight(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

/**
 * Compare two severities for sorting (descending severity).
 * @param a - First severity.
 * @param b - Second severity.
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return severityWeight(a) - severityWeight(b);
}

/**
 * Check whether a given severity meets or exceeds a threshold.
 * @param actual - The severity to check.
 * @param threshold - The minimum severity threshold.
 */
export function meetsThreshold(actual: Severity, threshold: Severity): boolean {
  return severityWeight(actual) <= severityWeight(threshold);
}

/**
 * Return the HTML badge markup for a severity level.
 * @param severity - The severity to render.
 */
export function severityHtmlBadge(severity: Severity): string {
  const cls = SEVERITY_CSS_CLASS[severity];
  const label = severity.charAt(0).toUpperCase() + severity.slice(1);
  return `<span class="badge ${cls}">${label}</span>`;
}

/**
 * Parse a raw severity string into a typed Severity, defaulting to 'info'.
 * @param raw - Raw string from npm audit JSON.
 */
export function parseSeverity(raw: string): Severity {
  const lower = raw.toLowerCase();
  if (SEVERITY_ORDER.includes(lower as Severity)) {
    return lower as Severity;
  }
  return 'info';
}
