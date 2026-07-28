/**
 * @fileoverview Core TypeScript interfaces for npm-audit-html-report.
 * These models represent the normalized internal representation of audit data.
 */

// ---------------------------------------------------------------------------
// Raw npm audit JSON shapes (v6 + v7+)
// ---------------------------------------------------------------------------

/** Severity level as returned by npm audit. */
export type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'info';

/** npm audit v7+ vulnerability entry (vuln object in `vulnerabilities` map). */
export interface RawVulnerabilityV7 {
  name: string;
  severity: Severity;
  isDirect: boolean;
  via: Array<RawViaEntry | string>;
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: boolean | RawFixAvailable;
}

export interface RawViaEntry {
  source?: number;
  name?: string;
  dependency?: string;
  title?: string;
  url?: string;
  severity?: Severity;
  cvss?: { score: number; vectorString: string };
  cwe?: string[];
  ghsas?: string[];
  range?: string;
}

export interface RawFixAvailable {
  name: string;
  version: string;
  isSemVerMajor: boolean;
}

/** npm audit v7+ report shape. */
export interface RawAuditReportV7 {
  auditReportVersion: 2;
  vulnerabilities: Record<string, RawVulnerabilityV7>;
  metadata: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
    dependencies: {
      prod: number;
      dev: number;
      optional: number;
      peer: number;
      peerOptional: number;
      total: number;
    };
  };
}

/** npm audit v6 advisory entry. */
export interface RawAdvisoryV6 {
  id: number;
  module_name: string;
  title: string;
  severity: Severity;
  url: string;
  cves: string[];
  cwe: string;
  patched_versions: string;
  vulnerable_versions: string;
  findings: Array<{ version: string; paths: string[] }>;
  recommendation: string;
  references: string;
}

/** npm audit v6 report shape. */
export interface RawAuditReportV6 {
  advisories: Record<string, RawAdvisoryV6>;
  metadata: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
    };
    totalDependencies: number;
  };
}

/** Union of supported raw npm audit JSON formats. */
export type RawAuditReport = RawAuditReportV7 | RawAuditReportV6;

// ---------------------------------------------------------------------------
// Normalized internal models
// ---------------------------------------------------------------------------

/** A fully normalized vulnerability record used throughout the app. */
export interface NormalizedVulnerability {
  /** Unique identifier (advisory id or package@range) */
  id: string;
  /** Affected package name */
  package: string;
  /** Severity level */
  severity: Severity;
  /** Short vulnerability title */
  title: string;
  /** Link to advisory or NVD */
  url: string;
  /** CVE identifiers */
  cve: string[];
  /** GitHub Security Advisory identifiers */
  ghsa: string[];
  /** Currently installed version */
  installedVersion: string;
  /** Version that patches the vulnerability */
  patchedVersion: string;
  /** Vulnerable version range */
  vulnerableVersions: string;
  /** Full dependency path (breadcrumb) */
  dependencyPath: string;
  /** Whether a fix is available */
  fixAvailable: boolean;
  /** Human-readable recommendation */
  recommendation: string;
  /** CVSS score if available */
  cvssScore?: number;
  /** CWE identifiers */
  cwe: string[];
  /** Whether vulnerability is in a direct dependency */
  isDirect: boolean;
}

/** Counts grouped by severity. */
export interface SeverityCounts {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  info: number;
}

/** Aggregated summary of an audit run. */
export interface AuditSummary {
  counts: SeverityCounts;
  total: number;
  fixable: number;
  nonFixable: number;
  totalDependencies: number;
}

/** Metadata about the environment when the audit was run. */
export interface AuditMeta {
  projectName: string;
  title: string;
  generatedAt: string;
  nodeVersion: string;
  npmVersion: string;
  auditMode: 'full' | 'production';
  theme: 'light' | 'dark';
}

/** Complete audit report (meta + summary + vulnerabilities). */
export interface AuditReport {
  meta: AuditMeta;
  summary: AuditSummary;
  vulnerabilities: NormalizedVulnerability[];
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** A persisted history entry stored in .history/. */
export interface HistoryEntry {
  timestamp: string;
  summary: AuditSummary;
  vulnerabilities: NormalizedVulnerability[];
}

/** Diff between two consecutive history entries. */
export interface HistoryDiff {
  newVulnerabilities: NormalizedVulnerability[];
  fixedVulnerabilities: NormalizedVulnerability[];
  unchanged: NormalizedVulnerability[];
}

// ---------------------------------------------------------------------------
// CLI Options
// ---------------------------------------------------------------------------

/** Parsed CLI options passed through the app. */
export interface ReportOptions {
  output: string;
  production: boolean;
  json: boolean;
  pdf: boolean;
  theme: 'light' | 'dark';
  title: string;
  failOn: Severity | null;
  open: boolean;
  history: boolean;
}
