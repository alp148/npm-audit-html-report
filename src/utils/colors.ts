/**
 * @fileoverview Colored console output helpers using chalk.
 * All output functions write to stderr to keep stdout clean for JSON output.
 */

import chalk from 'chalk';
import type { Severity } from '../models/audit.js';

/** Print an informational message to stderr. */
export function info(message: string): void {
  process.stderr.write(chalk.cyan('ℹ ') + chalk.white(message) + '\n');
}

/** Print a success message to stderr. */
export function success(message: string): void {
  process.stderr.write(chalk.green('✔ ') + chalk.white(message) + '\n');
}

/** Print a warning message to stderr. */
export function warn(message: string): void {
  process.stderr.write(chalk.yellow('⚠ ') + chalk.yellow(message) + '\n');
}

/** Print an error message to stderr. */
export function error(message: string): void {
  process.stderr.write(chalk.red('✖ ') + chalk.red(message) + '\n');
}

/** Print a step header to stderr. */
export function step(message: string): void {
  process.stderr.write(chalk.bold.blue('→ ') + chalk.bold(message) + '\n');
}

/** Print a blank line to stderr. */
export function blank(): void {
  process.stderr.write('\n');
}

/** Print a horizontal divider to stderr. */
export function divider(): void {
  process.stderr.write(chalk.gray('─'.repeat(60)) + '\n');
}

/**
 * Return a colored severity badge string for terminal output.
 * @param severity - The severity level to badge.
 */
export function severityBadge(severity: Severity): string {
  const label = severity.toUpperCase().padEnd(8);
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white.bold(` ${label} `);
    case 'high':
      return chalk.bgYellow.black.bold(` ${label} `);
    case 'moderate':
      return chalk.bgHex('#FFA500').black.bold(` ${label} `);
    case 'low':
      return chalk.bgBlue.white.bold(` ${label} `);
    case 'info':
      return chalk.bgGray.white.bold(` ${label} `);
  }
}

/** Print the CLI banner to stderr. */
export function banner(version: string): void {
  blank();
  process.stderr.write(
    chalk.bold.cyan('  npm-audit-html-report') +
      chalk.gray(` v${version}`) +
      '\n'
  );
  process.stderr.write(chalk.gray('  Modern interactive HTML security reports\n'));
  blank();
}
