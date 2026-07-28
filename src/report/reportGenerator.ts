/**
 * @fileoverview Orchestrates HTML report generation, PDF output, and file writing.
 */

import path from 'path';
import { buildHtml } from './htmlBuilder.js';
import { writeFile, ensureDir } from '../utils/file.js';
import { toFileSafeIso } from '../utils/date.js';
import * as log from '../utils/colors.js';
import type { AuditReport, HistoryEntry, ReportOptions } from '../models/audit.js';

/** Result returned after report generation. */
export interface GenerateResult {
  htmlPath: string;
  pdfPath: string | null;
}

/**
 * Generate the HTML (and optionally PDF) security report.
 *
 * @param report - Normalized audit report.
 * @param options - CLI options.
 * @param historyEntries - Previous history entries for trend chart.
 * @returns Paths to the generated files.
 */
export async function generateReport(
  report: AuditReport,
  options: ReportOptions,
  historyEntries: HistoryEntry[] = []
): Promise<GenerateResult> {
  await ensureDir(options.output);

  const timestamp = toFileSafeIso();
  const htmlFilename = `audit-report-${timestamp}.html`;
  const htmlPath = path.join(options.output, htmlFilename);

  log.step('Building HTML report…');
  const html = await buildHtml(report, historyEntries);

  log.step(`Writing report → ${htmlPath}`);
  await writeFile(htmlPath, html);

  log.success(`HTML report saved: ${htmlPath}`);

  let pdfPath: string | null = null;

  if (options.pdf) {
    pdfPath = await generatePdf(htmlPath, options.output, timestamp);
  }

  if (options.open) {
    await openInBrowser(htmlPath);
  }

  return { htmlPath, pdfPath };
}

/**
 * Generate a PDF from the HTML report using Puppeteer.
 * Puppeteer is an optional dependency — this function will throw a friendly
 * error if it is not installed.
 *
 * @param htmlPath - Absolute path to the HTML file.
 * @param outputDir - Directory to write the PDF.
 * @param timestamp - Timestamp string for the filename.
 */
async function generatePdf(
  htmlPath: string,
  outputDir: string,
  timestamp: string
): Promise<string> {
  log.step('Generating PDF…');

  let puppeteer: typeof import('puppeteer');
  try {
    // Dynamic import so puppeteer is truly optional
    puppeteer = await import('puppeteer');
  } catch {
    log.warn(
      'Puppeteer is not installed. Install it with:\n' +
        '  npm install puppeteer\n' +
        'to enable PDF generation.'
    );
    throw new Error('Puppeteer is required for PDF generation but is not installed.');
  }

  const pdfFilename = `audit-report-${timestamp}.pdf`;
  const pdfPath = path.join(outputDir, pdfFilename);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    });

    // Wait for charts to render
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
    });

    log.success(`PDF report saved: ${pdfPath}`);
    return pdfPath;
  } finally {
    await browser.close();
  }
}

/**
 * Open the HTML report in the system's default browser.
 * @param filePath - Absolute path to the HTML file.
 */
async function openInBrowser(filePath: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const open = require('open') as (target: string) => Promise<unknown>;
    await open(filePath);
    log.info(`Opened report in browser.`);
  } catch (err) {
    log.warn(`Could not open browser: ${(err as Error).message}`);
  }
}
