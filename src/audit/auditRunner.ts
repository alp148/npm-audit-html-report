/**
 * @fileoverview Spawns `npm audit --json` and returns the raw JSON string.
 */

import { spawn } from 'child_process';
import type { ReportOptions } from '../models/audit.js';

/** Result from running npm audit. */
export interface AuditRunResult {
  /** Raw JSON string from stdout. */
  raw: string;
  /** npm audit exit code (non-zero means vulnerabilities were found, not an error). */
  exitCode: number;
}

/**
 * Run `npm audit --json` (or `--omit=dev --json`) and collect the output.
 *
 * npm audit exits with a non-zero code when vulnerabilities are found — this is
 * expected behaviour and is NOT treated as an execution error.
 *
 * @param options - CLI options controlling production mode.
 * @param cwd - Working directory to run the audit in (defaults to process.cwd()).
 * @throws When the process cannot be spawned (e.g. npm not found).
 */
export async function runAudit(
  options: ReportOptions,
  cwd: string = process.cwd()
): Promise<AuditRunResult> {
  const args = ['audit', '--json'];

  if (options.production) {
    args.push('--omit=dev');
  }

  return new Promise<AuditRunResult>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];

    const child = spawn('npm', args, {
      cwd,
      // Use 'pipe' for stdout/stderr; inherit stdin so npm can read .npmrc etc.
      stdio: ['inherit', 'pipe', 'pipe'],
      // On Windows, npm is a .cmd file — shell: true is required
      shell: process.platform === 'win32',
    });

    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      errorChunks.push(chunk);
    });

    child.on('error', (err: Error) => {
      reject(
        new Error(
          `Failed to spawn "npm audit": ${err.message}\n` +
            'Ensure npm is installed and available in PATH.'
        )
      );
    });

    child.on('close', (code: number | null) => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();

      if (!raw) {
        // npm printed nothing to stdout — likely a real execution error
        const errOutput = Buffer.concat(errorChunks).toString('utf-8').trim();
        reject(
          new Error(
            `"npm audit" produced no output (exit code ${code ?? 'null'}).\n` +
              (errOutput ? `stderr:\n${errOutput}` : 'No stderr output.')
          )
        );
        return;
      }

      resolve({ raw, exitCode: code ?? 0 });
    });
  });
}
