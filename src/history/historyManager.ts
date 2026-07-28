/**
 * @fileoverview Manages historical audit scan data stored in .history/.
 * Enables trend charts and new/fixed vulnerability diffing.
 */

import path from 'path';
import { ensureDir, writeJson, readJson, listFiles } from '../utils/file.js';
import { toFileSafeIso } from '../utils/date.js';
import type { AuditReport, HistoryEntry } from '../models/audit.js';

/** Default directory for history files (relative to cwd). */
const DEFAULT_HISTORY_DIR = '.history';

/**
 * Save the current audit report as a history entry.
 *
 * @param report - The current audit report to persist.
 * @param historyDir - Directory to store history files (default: .history/).
 */
export async function saveHistory(
  report: AuditReport,
  historyDir: string = DEFAULT_HISTORY_DIR
): Promise<void> {
  await ensureDir(historyDir);

  const entry: HistoryEntry = {
    timestamp: report.meta.generatedAt,
    summary: report.summary,
    vulnerabilities: report.vulnerabilities,
  };

  const filename = `${toFileSafeIso(new Date(report.meta.generatedAt))}.json`;
  const filePath = path.join(historyDir, filename);

  await writeJson(filePath, entry);
}

/**
 * Load all history entries sorted by date (oldest first).
 *
 * @param historyDir - Directory to read history files from.
 * @returns Array of HistoryEntry objects, sorted oldest → newest.
 */
export async function loadHistory(
  historyDir: string = DEFAULT_HISTORY_DIR
): Promise<HistoryEntry[]> {
  const files = await listFiles(historyDir, '.json');

  const entries: HistoryEntry[] = [];
  for (const filePath of files) {
    try {
      const entry = await readJson<HistoryEntry>(filePath);
      entries.push(entry);
    } catch {
      // Silently skip malformed history files
    }
  }

  // Sort by timestamp ascending (oldest first)
  return entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * Return the most recent history entry before the current scan, or null.
 *
 * @param historyDir - Directory to read history files from.
 */
export async function loadPreviousEntry(
  historyDir: string = DEFAULT_HISTORY_DIR
): Promise<HistoryEntry | null> {
  const entries = await loadHistory(historyDir);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}
