/**
 * @fileoverview Parses raw npm audit JSON (v6 and v7+) into normalized models.
 */

import type {
  AuditReport,
  AuditSummary,
  NormalizedVulnerability,
  RawAuditReport,
  RawAuditReportV6,
  RawAuditReportV7,
  RawFixAvailable,
  RawViaEntry,
  Severity,
  AuditMeta,
} from '../models/audit.js';
import { parseSeverity, compareSeverity } from '../utils/severity.js';

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

function isV7(report: RawAuditReport): report is RawAuditReportV7 {
  return (report as RawAuditReportV7).auditReportVersion === 2;
}

function isV6(report: RawAuditReport): report is RawAuditReportV6 {
  return 'advisories' in report;
}

// ---------------------------------------------------------------------------
// v7 parser
// ---------------------------------------------------------------------------

function parseV7(raw: RawAuditReportV7): NormalizedVulnerability[] {
  const vulns: NormalizedVulnerability[] = [];

  for (const [pkgName, vuln] of Object.entries(raw.vulnerabilities)) {
    // Gather advisory details from the `via` array entries
    const viaEntries = vuln.via.filter(
      (v): v is RawViaEntry => typeof v === 'object'
    );

    const title =
      viaEntries.find((v) => v.title)?.title ?? `Vulnerability in ${pkgName}`;
    const url = viaEntries.find((v) => v.url)?.url ?? '';
    const cvssScore = viaEntries.find((v) => v.cvss)?.cvss?.score;
    const cwe = viaEntries.flatMap((v) => v.cwe ?? []);

    // Collect GHSA ids from URLs
    const ghsa = viaEntries
      .map((v) => v.url ?? '')
      .filter((u) => u.includes('GHSA-'))
      .map((u) => {
        const match = /GHSA-[\w-]+/.exec(u);
        return match ? match[0] : '';
      })
      .filter(Boolean);

    const cve = viaEntries
      .map((v) => v.url ?? '')
      .filter((u) => u.includes('CVE-'))
      .map((u) => {
        const match = /CVE-\d+-\d+/.exec(u);
        return match ? match[0] : '';
      })
      .filter(Boolean);

    const fixAvailable = typeof vuln.fixAvailable === 'boolean'
      ? vuln.fixAvailable
      : typeof vuln.fixAvailable === 'object' && vuln.fixAvailable !== null;

    const fixInfo = typeof vuln.fixAvailable === 'object' && vuln.fixAvailable !== null
      ? (vuln.fixAvailable as RawFixAvailable)
      : null;

    const patchedVersion = fixInfo ? `${fixInfo.version}` : '';
    const recommendation = fixAvailable
      ? fixInfo
        ? `npm install ${pkgName}@${fixInfo.version}`
        : `npm audit fix`
      : 'No fix available — review manually';

    vulns.push({
      id: `${pkgName}@${vuln.range}`,
      package: pkgName,
      severity: parseSeverity(vuln.severity),
      title,
      url,
      cve,
      ghsa,
      installedVersion: vuln.range,
      patchedVersion,
      vulnerableVersions: vuln.range,
      dependencyPath: vuln.nodes.join(' → '),
      fixAvailable,
      recommendation,
      cvssScore,
      cwe,
      isDirect: vuln.isDirect,
    });
  }

  return vulns.sort((a, b) => compareSeverity(a.severity, b.severity));
}

// ---------------------------------------------------------------------------
// v6 parser
// ---------------------------------------------------------------------------

function parseV6(raw: RawAuditReportV6): NormalizedVulnerability[] {
  const vulns: NormalizedVulnerability[] = [];

  for (const advisory of Object.values(raw.advisories)) {
    const installedVersion =
      advisory.findings[0]?.version ?? 'unknown';
    const dependencyPaths = advisory.findings
      .flatMap((f) => f.paths)
      .slice(0, 3)
      .join(', ');

    const ghsa = advisory.url?.includes('GHSA-')
      ? [(/GHSA-[\w-]+/.exec(advisory.url) ?? [])[0] ?? ''].filter(Boolean)
      : [];

    const fixAvailable = advisory.patched_versions !== '<0.0.0';

    vulns.push({
      id: String(advisory.id),
      package: advisory.module_name,
      severity: parseSeverity(advisory.severity),
      title: advisory.title,
      url: advisory.url,
      cve: advisory.cves,
      ghsa,
      installedVersion,
      patchedVersion: advisory.patched_versions,
      vulnerableVersions: advisory.vulnerable_versions,
      dependencyPath: dependencyPaths,
      fixAvailable,
      recommendation: advisory.recommendation,
      cvssScore: undefined,
      cwe: advisory.cwe ? [advisory.cwe] : [],
      isDirect: false,
    });
  }

  return vulns.sort((a, b) => compareSeverity(a.severity, b.severity));
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
  vulns: NormalizedVulnerability[],
  raw: RawAuditReport
): AuditSummary {
  const counts = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    info: 0,
  };

  let fixable = 0;
  let nonFixable = 0;

  for (const v of vulns) {
    counts[v.severity as keyof typeof counts]++;
    if (v.fixAvailable) fixable++;
    else nonFixable++;
  }

  let totalDependencies = 0;
  if (isV7(raw)) {
    totalDependencies = raw.metadata.dependencies.total;
  } else if (isV6(raw)) {
    totalDependencies = raw.metadata.totalDependencies;
  }

  return {
    counts,
    total: vulns.length,
    fixable,
    nonFixable,
    totalDependencies,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a raw npm audit JSON string into a normalized AuditReport.
 *
 * @param rawJson - The raw JSON string from `npm audit --json`.
 * @param meta - Metadata about the audit run environment.
 * @throws When the JSON is invalid or the format is unrecognized.
 */
export function parseAudit(rawJson: string, meta: AuditMeta): AuditReport {
  let parsed: RawAuditReport;

  try {
    parsed = JSON.parse(rawJson) as RawAuditReport;
  } catch (err) {
    throw new Error(
      `Failed to parse npm audit JSON output: ${(err as Error).message}`
    );
  }

  let vulnerabilities: NormalizedVulnerability[];

  if (isV7(parsed)) {
    vulnerabilities = parseV7(parsed);
  } else if (isV6(parsed)) {
    vulnerabilities = parseV6(parsed);
  } else {
    throw new Error(
      'Unrecognized npm audit JSON format. Expected v6 (advisories) or v7 (auditReportVersion: 2).'
    );
  }

  const summary = buildSummary(vulnerabilities, parsed);

  return { meta, summary, vulnerabilities };
}

/**
 * Detect which npm audit report version a raw JSON string is.
 * @param rawJson - Raw JSON string.
 */
export function detectAuditVersion(rawJson: string): 6 | 7 | null {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (parsed['auditReportVersion'] === 2) return 7;
    if ('advisories' in parsed) return 6;
    return null;
  } catch {
    return null;
  }
}

/**
 * Return the total vulnerability count from a raw JSON string without full parsing.
 * @param rawJson - Raw JSON string.
 */
export function quickCount(rawJson: string): number {
  try {
    const parsed = JSON.parse(rawJson) as RawAuditReport;
    if (isV7(parsed)) {
      return Object.keys(parsed.vulnerabilities).length;
    }
    if (isV6(parsed)) {
      return Object.keys(parsed.advisories).length;
    }
  } catch {
    /* swallow */
  }
  return 0;
}

/**
 * Extract severity counts directly from the raw JSON metadata.
 * Useful for a quick summary before full parsing.
 * @param rawJson - Raw JSON string.
 */
export function quickSeverityCounts(rawJson: string): Record<Severity, number> | null {
  try {
    const parsed = JSON.parse(rawJson) as RawAuditReport;
    if (isV7(parsed)) {
      return {
        critical: parsed.metadata.vulnerabilities.critical,
        high: parsed.metadata.vulnerabilities.high,
        moderate: parsed.metadata.vulnerabilities.moderate,
        low: parsed.metadata.vulnerabilities.low,
        info: parsed.metadata.vulnerabilities.info,
      };
    }
    if (isV6(parsed)) {
      return {
        critical: parsed.metadata.vulnerabilities.critical,
        high: parsed.metadata.vulnerabilities.high,
        moderate: parsed.metadata.vulnerabilities.moderate,
        low: parsed.metadata.vulnerabilities.low,
        info: 0,
      };
    }
  } catch {
    /* swallow */
  }
  return null;
}
