#!/usr/bin/env node
/**
 * @fileoverview CLI entry point for npm-audit-html-report.
 *
 * Orchestrates:
 *   1. Parse CLI options (Commander)
 *   2. Run npm audit
 *   3. Parse JSON output
 *   4. Optionally save/load history
 *   5. Generate HTML (and PDF) report
 *   6. Check --fail-on threshold
 *   7. Exit with correct code
 *
 * Exit codes:
 *   0 — Success / no vulnerabilities above threshold
 *   1 — Vulnerability threshold exceeded
 *   2 — Execution error (spawn failure, parse error, write error)
 */

import { Command, InvalidArgumentError } from 'commander';
import path from 'path';
import { execSync } from 'child_process';
import { runAudit } from './audit/auditRunner.js';
import { parseAudit } from './audit/auditParser.js';
import { generateReport } from './report/reportGenerator.js';
import { saveHistory, loadHistory } from './history/historyManager.js';
import { meetsThreshold } from './utils/severity.js';
import * as log from './utils/colors.js';
import { toDisplayDate } from './utils/date.js';
import type { AuditReport, ReportOptions, Severity } from './models/audit.js';
import pkgJson from '../package.json';

// ── Package version ───────────────────────────────────────────────────────
const PKG_VERSION: string = pkgJson.version;

// ── Helpers ───────────────────────────────────────────────────────────────

function getNodeVersion(): string {
  return process.version.replace(/^v/, '');
}

function getNpmVersion(): string {
  try {
    return execSync('npm --version', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getProjectName(cwd: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require(path.join(cwd, 'package.json')) as { name?: string };
    return pkg.name ?? path.basename(cwd);
  } catch {
    return path.basename(cwd);
  }
}

function parseSeverityArg(value: string): Severity {
  const valid: Severity[] = ['critical', 'high', 'moderate', 'low', 'info'];
  if (!valid.includes(value as Severity)) {
    throw new InvalidArgumentError(
      `Invalid severity "${value}". Valid values: ${valid.join(', ')}`
    );
  }
  return value as Severity;
}

function parseThemeArg(value: string): 'light' | 'dark' {
  if (value !== 'light' && value !== 'dark') {
    throw new InvalidArgumentError(`Invalid theme "${value}". Valid values: light, dark`);
  }
  return value;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('audit-report')
    .description('Generate modern interactive HTML security reports from npm audit')
    .version(PKG_VERSION, '-v, --version', 'Output the current version')
    .option('-o, --output <directory>', 'Output directory for the report', 'reports')
    .option('-p, --production', 'Audit only production dependencies (--omit=dev)', false)
    .option('-j, --json', 'Print the parsed audit JSON to stdout', false)
    .option('--pdf', 'Generate a PDF report alongside the HTML (requires puppeteer)', false)
    .option(
      '-t, --theme <theme>',
      'Report colour theme: light | dark',
      parseThemeArg,
      'dark'
    )
    .option('--title <title>', 'Custom title for the report', 'Security Audit Report')
    .option(
      '--fail-on <severity>',
      'Exit with code 1 if vulnerabilities at or above this severity are found',
      parseSeverityArg
    )
    .option('--open', 'Open the report in the default browser after generation', false)
    .option('--history', 'Enable scan history and trend chart (.history/ directory)', false)
    .addHelpText(
      'after',
      `
Examples:
  $ audit-report
  $ audit-report --production --output reports --theme dark --title "My App"
  $ audit-report --fail-on high
  $ audit-report --history --open
  $ npx npm-audit-html-report --pdf
`
    );

  program.parse(process.argv);

  const opts = program.opts<{
    output: string;
    production: boolean;
    json: boolean;
    pdf: boolean;
    theme: 'light' | 'dark';
    title: string;
    failOn?: Severity;
    open: boolean;
    history: boolean;
  }>();

  const options: ReportOptions = {
    output: path.resolve(opts.output),
    production: opts.production,
    json: opts.json,
    pdf: opts.pdf,
    theme: opts.theme,
    title: opts.title,
    failOn: opts.failOn ?? null,
    open: opts.open,
    history: opts.history,
  };

  // Print banner only when not in JSON mode (to keep stdout clean)
  if (!options.json) {
    log.banner(PKG_VERSION);
    log.divider();
  }

  const cwd = process.cwd();
  const nodeVersion = getNodeVersion();
  const npmVersion = getNpmVersion();
  const projectName = getProjectName(cwd);

  try {
    // ── Step 1: Run npm audit ──────────────────────────────────
    if (!options.json) {
      log.step(
        `Running npm audit${options.production ? ' (production only)' : ''}…`
      );
    }

    let runResult: Awaited<ReturnType<typeof runAudit>>;
    try {
      runResult = await runAudit(options, cwd);
    } catch (err) {
      log.error(`npm audit failed: ${(err as Error).message}`);
      process.exit(2);
    }

    // ── Step 2: Parse JSON ────────────────────────────────────
    if (!options.json) log.step('Parsing audit results…');

    const auditMeta = {
      projectName,
      title: options.title,
      generatedAt: toDisplayDate(),
      nodeVersion,
      npmVersion,
      auditMode: (options.production ? 'production' : 'full') as 'full' | 'production',
      theme: options.theme,
    };

    let report: AuditReport;
    try {
      report = parseAudit(runResult.raw, auditMeta);
    } catch (err) {
      log.error(`Failed to parse audit JSON: ${(err as Error).message}`);
      process.exit(2);
    }

    // ── Step 3: JSON output mode ──────────────────────────────
    if (options.json) {
      process.stdout.write(JSON.stringify(report, null, 2));
      process.stdout.write('\n');
      return;
    }

    // ── Step 4: Print summary to console ─────────────────────
    log.blank();
    log.divider();
    log.info(`Project:   ${projectName}`);
    log.info(`Total:     ${report.summary.total} vulnerabilities`);
    log.info(`Critical:  ${report.summary.counts.critical}`);
    log.info(`High:      ${report.summary.counts.high}`);
    log.info(`Moderate:  ${report.summary.counts.moderate}`);
    log.info(`Low:       ${report.summary.counts.low}`);
    log.info(`Fixable:   ${report.summary.fixable}`);
    log.divider();
    log.blank();

    // ── Step 5: History ───────────────────────────────────────
    let historyEntries: Awaited<ReturnType<typeof loadHistory>> = [];

    if (options.history) {
      log.step('Loading scan history…');
      historyEntries = await loadHistory();
      log.info(`Found ${historyEntries.length} previous scan(s).`);
    }

    // ── Step 6: Generate Report ───────────────────────────────
    const result = await generateReport(report, options, historyEntries);

    // ── Step 7: Save history (after report generation) ────────
    if (options.history) {
      log.step('Saving scan to history…');
      await saveHistory(report);
    }

    // ── Step 8: Check fail-on threshold ──────────────────────
    if (options.failOn) {
      const hasExceeded = report.vulnerabilities.some((v) =>
        meetsThreshold(v.severity, options.failOn as Severity)
      );

      if (hasExceeded) {
        log.blank();
        log.warn(
          `Threshold exceeded: vulnerabilities at or above "${options.failOn}" were found.`
        );
        log.info(`HTML report: ${result.htmlPath}`);
        process.exit(1);
      }
    }

    log.blank();
    log.success('Report generation complete!');
    log.info(`HTML: ${result.htmlPath}`);
    if (result.pdfPath) log.info(`PDF:  ${result.pdfPath}`);
    log.blank();

  } catch (err) {
    log.error(`Unexpected error: ${(err as Error).message}`);
    if (process.env['DEBUG']) {
      console.error(err);
    }
    process.exit(2);
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(2);
});
