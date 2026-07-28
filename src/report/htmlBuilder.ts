/**
 * @fileoverview Compiles the Handlebars template with the audit report data
 * and inlines CSS / JS to produce a fully self-contained static HTML file.
 */

import Handlebars from 'handlebars';
import path from 'path';
import { readFile } from '../utils/file.js';
import { toDisplayDate } from '../utils/date.js';
import type { AuditReport, HistoryEntry, NormalizedVulnerability } from '../models/audit.js';

/** Template context shape passed to Handlebars. */
interface TemplateContext {
  meta: AuditReport['meta'];
  summary: AuditReport['summary'];
  inlinedCss: string;
  inlinedJs: string;
  reportDataJson: string;
  historyDataJson: string;
  hasHistory: boolean;
  historyDiff: HistoryDiffContext | null;
}

interface HistoryDiffContext {
  newVulnerabilities: NormalizedVulnerability[];
  fixedVulnerabilities: NormalizedVulnerability[];
  newCount: number;
  fixedCount: number;
}

/** Register all Handlebars helpers used in report.hbs. */
function registerHelpers(): void {
  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
  Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
  Handlebars.registerHelper('ternary', (cond: unknown, t: unknown, f: unknown) => (cond ? t : f));

  Handlebars.registerHelper('formatDate', (isoString: string) => {
    try {
      return toDisplayDate(new Date(isoString));
    } catch {
      return isoString;
    }
  });

  Handlebars.registerHelper('truncate', (str: string, len: number) => {
    if (typeof str !== 'string') return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  });

  Handlebars.registerHelper('join', (arr: unknown[], sep = ', ') => {
    if (!Array.isArray(arr)) return '';
    return arr.join(String(sep));
  });

  Handlebars.registerHelper('severityClass', (severity: string) => {
    const map: Record<string, string> = {
      critical: 'severity-critical',
      high: 'severity-high',
      moderate: 'severity-moderate',
      low: 'severity-low',
      info: 'severity-info',
    };
    return map[severity] ?? 'severity-info';
  });

  Handlebars.registerHelper('capitalise', (str: string) => {
    if (typeof str !== 'string' || !str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
}

/**
 * Compute the historical diff between the previous and current scan.
 */
function computeHistoryDiff(
  prevEntry: HistoryEntry,
  current: AuditReport
): HistoryDiffContext {
  const prevIds = new Set(prevEntry.vulnerabilities.map((v) => v.id));
  const currIds = new Set(current.vulnerabilities.map((v) => v.id));

  const newVulnerabilities = current.vulnerabilities.filter((v) => !prevIds.has(v.id));
  const fixedVulnerabilities = prevEntry.vulnerabilities.filter((v) => !currIds.has(v.id));

  return {
    newVulnerabilities,
    fixedVulnerabilities,
    newCount: newVulnerabilities.length,
    fixedCount: fixedVulnerabilities.length,
  };
}

/**
 * Build a fully self-contained HTML string from the audit report.
 *
 * @param report - The normalized audit report.
 * @param historyEntries - Previous history entries (may be empty).
 * @returns HTML string ready to write to disk.
 */
export async function buildHtml(
  report: AuditReport,
  historyEntries: HistoryEntry[] = []
): Promise<string> {
  registerHelpers();

  const templateDir = path.join(__dirname, 'templates');
  const assetsDir = path.join(__dirname, '..', 'assets');

  const [templateSource, css, js] = await Promise.all([
    readFile(path.join(templateDir, 'report.hbs')),
    readFile(path.join(assetsDir, 'style.css')),
    readFile(path.join(assetsDir, 'report.js')),
  ]);

  const template = Handlebars.compile(templateSource, { noEscape: false });

  // Include history entries in chart data (append current at the end)
  const allHistory: HistoryEntry[] = [
    ...historyEntries,
    {
      timestamp: report.meta.generatedAt,
      summary: report.summary,
      vulnerabilities: report.vulnerabilities,
    },
  ];

  const historyDiff: HistoryDiffContext | null =
    historyEntries.length > 0
      ? computeHistoryDiff(historyEntries[historyEntries.length - 1], report)
      : null;

  const context: TemplateContext = {
    meta: report.meta,
    summary: report.summary,
    inlinedCss: css,
    inlinedJs: js,
    // Serialize safely — escape </script> sequences
    reportDataJson: JSON.stringify(report).replace(/<\/script>/gi, '<\\/script>'),
    historyDataJson: JSON.stringify(allHistory).replace(/<\/script>/gi, '<\\/script>'),
    hasHistory: allHistory.length > 1,
    historyDiff,
  };

  return template(context);
}
