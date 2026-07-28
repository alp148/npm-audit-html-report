/**
 * npm-audit-html-report — report.js
 * Vanilla JS frontend: theme, search, filter, sort, pagination,
 * expandable rows, CSV export, copy-to-clipboard, Chart.js charts.
 *
 * Depends on: Chart.js (loaded via CDN in the template)
 * No build step — this file is inlined directly into the HTML report.
 */

/* ── Globals injected by Handlebars template ─────────────── */
// window.REPORT_DATA  — full AuditReport JSON
// window.REPORT_THEME — 'light' | 'dark'
// window.HISTORY_DATA — HistoryEntry[] | null

(function () {
  'use strict';

  // ── Constants ───────────────────────────────────────────────
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const DEFAULT_PAGE_SIZE = 25;

  // ── State ────────────────────────────────────────────────────
  const state = {
    theme: window.REPORT_THEME || 'light',
    search: '',
    severityFilter: 'all',
    fixableFilter: 'all',
    sortColumn: 'severity',
    sortDir: 'asc',
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    filtered: [],
    all: [],
  };

  // ── DOM helpers ──────────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function show(el) { if (el) el.style.display = ''; }
  function hide(el) { if (el) el.style.display = 'none'; }

  // ── Theme ────────────────────────────────────────────────────
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const toggle = $('#theme-checkbox');
    if (toggle) toggle.checked = theme === 'dark';
    localStorage.setItem('audit-report-theme', theme);
    updateChartColors();
  }

  function initTheme() {
    const saved = localStorage.getItem('audit-report-theme');
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
    applyTheme(saved || window.REPORT_THEME || preferred);

    const toggle = $('#theme-checkbox');
    if (toggle) {
      toggle.addEventListener('change', () => {
        applyTheme(toggle.checked ? 'dark' : 'light');
      });
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('audit-report-theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // ── Toast notifications ──────────────────────────────────────
  function showToast(message, type = 'info', duration = 2800) {
    const container = $('#toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <span>${iconFor(type)}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastIn 250ms ease-out reverse';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.className = 'toast-container';
    document.body.appendChild(div);
    return div;
  }

  function iconFor(type) {
    return { success: '✔', error: '✖', info: 'ℹ' }[type] || 'ℹ';
  }

  // ── Copy to clipboard ────────────────────────────────────────
  function initCopyButtons() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;
      const text = btn.dataset.copy || '';
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '⧉'; }, 1500);
      }).catch(() => {
        showToast('Failed to copy', 'error');
      });
    });
  }

  // ── Data & filtering ─────────────────────────────────────────
  function initData() {
    state.all = (window.REPORT_DATA?.vulnerabilities || []);
    applyFilters();
  }

  const SEVERITY_WEIGHT = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };

  function applyFilters() {
    const q = state.search.toLowerCase();
    let result = state.all.filter((v) => {
      if (state.severityFilter !== 'all' && v.severity !== state.severityFilter) return false;
      if (state.fixableFilter === 'fixable' && !v.fixAvailable) return false;
      if (state.fixableFilter === 'non-fixable' && v.fixAvailable) return false;
      if (q && !matchesSearch(v, q)) return false;
      return true;
    });

    // Sort
    result = sortVulnerabilities(result);

    state.filtered = result;
    state.page = 1;
    renderTable();
    renderPagination();
  }

  function matchesSearch(v, q) {
    return (
      v.package.toLowerCase().includes(q) ||
      v.title.toLowerCase().includes(q) ||
      v.severity.toLowerCase().includes(q) ||
      v.cve.some((c) => c.toLowerCase().includes(q)) ||
      v.ghsa.some((g) => g.toLowerCase().includes(q)) ||
      v.installedVersion.toLowerCase().includes(q)
    );
  }

  function sortVulnerabilities(arr) {
    return [...arr].sort((a, b) => {
      let cmp = 0;
      switch (state.sortColumn) {
        case 'severity':
          cmp = (SEVERITY_WEIGHT[a.severity] ?? 99) - (SEVERITY_WEIGHT[b.severity] ?? 99);
          break;
        case 'package':
          cmp = a.package.localeCompare(b.package);
          break;
        case 'installed':
          cmp = a.installedVersion.localeCompare(b.installedVersion);
          break;
        case 'fixed':
          cmp = a.patchedVersion.localeCompare(b.patchedVersion);
          break;
        case 'fixAvailable':
          cmp = Number(b.fixAvailable) - Number(a.fixAvailable);
          break;
        default:
          cmp = 0;
      }
      return state.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  // ── Table rendering ──────────────────────────────────────────
  function renderTable() {
    const tbody = $('#vuln-tbody');
    if (!tbody) return;

    const start = (state.page - 1) * state.pageSize;
    const pageData = state.filtered.slice(start, start + state.pageSize);

    if (pageData.length === 0) {
      tbody.innerHTML = `
        <tr class="no-results-row">
          <td colspan="9">
            <div class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <div class="empty-state-title">No vulnerabilities found</div>
              <div class="empty-state-desc">Try adjusting your search or filters.</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = pageData.map((v, i) => renderRow(v, start + i)).join('');
  }

  function severityBadgeHtml(severity) {
    const map = {
      critical: 'severity-critical',
      high: 'severity-high',
      moderate: 'severity-moderate',
      low: 'severity-low',
      info: 'severity-info',
    };
    const cls = map[severity] || 'severity-info';
    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function renderRow(v, idx) {
    const cveLinks = v.cve.map((c) =>
      `<a class="link-tag" href="https://nvd.nist.gov/vuln/detail/${c}" target="_blank" rel="noopener">${c}</a>`
    ).join('');

    const ghsaLinks = v.ghsa.map((g) =>
      `<a class="link-tag" href="https://github.com/advisories/${g}" target="_blank" rel="noopener">${g}</a>`
    ).join('');

    const fix = v.fixAvailable
      ? `<span class="fix-yes" aria-label="Fix available">✔ Yes</span>`
      : `<span class="fix-no" aria-label="No fix available">✖ No</span>`;

    const titleHtml = v.url
      ? `<a href="${escHtml(v.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;text-underline-offset:2px">${escHtml(v.title)}</a>`
      : escHtml(v.title);

    return `
      <tr class="vuln-row" data-idx="${idx}" tabindex="0" role="button"
          aria-expanded="false" aria-label="${escHtml(v.package)} — ${escHtml(v.severity)} severity">
        <td>${severityBadgeHtml(v.severity)}</td>
        <td><strong>${escHtml(v.package)}</strong></td>
        <td><span class="mono">${escHtml(v.installedVersion)}</span></td>
        <td><span class="mono">${escHtml(v.patchedVersion) || '—'}</span></td>
        <td><div class="tags-cell">${cveLinks || '—'}</div></td>
        <td><div class="tags-cell">${ghsaLinks || '—'}</div></td>
        <td>${fix}</td>
        <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${titleHtml}</td>
        <td>
          <span class="sort-icon" style="float:right;color:var(--text-muted)" aria-hidden="true">▼</span>
        </td>
      </tr>
      <tr class="detail-row" id="detail-${idx}">
        <td colspan="9">
          ${renderDetailPanel(v)}
        </td>
      </tr>`;
  }

  function renderDetailPanel(v) {
    const cveLinks = v.cve.map((c) =>
      `<a href="https://nvd.nist.gov/vuln/detail/${c}" target="_blank" rel="noopener" class="link-tag">${c}</a>`
    ).join(' ');

    const ghsaLinks = v.ghsa.map((g) =>
      `<a href="https://github.com/advisories/${g}" target="_blank" rel="noopener" class="link-tag">${g}</a>`
    ).join(' ');

    const cweList = v.cwe.length ? v.cwe.join(', ') : '—';
    const cvss = v.cvssScore != null ? v.cvssScore.toFixed(1) : '—';

    return `
      <div class="detail-panel">
        <div class="detail-grid">
          <div>
            <div class="detail-section">
              <h4>📦 Package</h4>
              <div class="detail-value"><strong>${escHtml(v.package)}</strong> ${v.isDirect ? '<span class="badge severity-info" style="margin-left:4px">direct</span>' : ''}</div>
            </div>
            <div class="detail-section" style="margin-top:16px">
              <h4>🔗 References</h4>
              <div class="detail-value" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
                ${cveLinks || '—'}
                ${ghsaLinks}
              </div>
            </div>
            <div class="detail-section" style="margin-top:16px">
              <h4>🛡 CWE / CVSS</h4>
              <div class="detail-value">CWE: ${escHtml(cweList)} &nbsp;|&nbsp; CVSS: ${escHtml(cvss)}</div>
            </div>
            <div class="detail-section" style="margin-top:16px">
              <h4>📍 Dependency Path</h4>
              <div class="detail-value mono" style="font-size:12px;word-break:break-all">${escHtml(v.dependencyPath) || '—'}</div>
            </div>
          </div>
          <div>
            <div class="detail-section">
              <h4>📋 Description</h4>
              <div class="detail-value">${escHtml(v.title)}</div>
            </div>
            <div class="detail-section" style="margin-top:16px">
              <h4>🔧 Recommended Fix</h4>
              <div class="command-block">
                <code class="command-text" id="cmd-${escHtml(v.id)}">${escHtml(v.recommendation)}</code>
                <button class="copy-btn" data-copy="${escHtml(v.recommendation)}"
                        title="Copy command" aria-label="Copy recommended fix command">⧉</button>
              </div>
            </div>
            <div class="detail-section" style="margin-top:16px">
              <h4>📌 Version Info</h4>
              <div class="detail-value">
                Installed: <span class="mono">${escHtml(v.installedVersion)}</span><br>
                Vulnerable: <span class="mono">${escHtml(v.vulnerableVersions)}</span><br>
                Patched: <span class="mono">${escHtml(v.patchedVersion) || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function escHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Row expansion ────────────────────────────────────────────
  function initTableInteractivity() {
    const tbody = $('#vuln-tbody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
      const row = e.target.closest('.vuln-row');
      if (!row || e.target.closest('a')) return;
      toggleRow(row);
    });

    tbody.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('.vuln-row');
      if (!row) return;
      e.preventDefault();
      toggleRow(row);
    });
  }

  function toggleRow(row) {
    const idx = row.dataset.idx;
    const detailRow = $(`#detail-${idx}`);
    if (!detailRow) return;

    const isExpanded = detailRow.classList.contains('visible');
    // Collapse all
    $$('.detail-row.visible').forEach((r) => r.classList.remove('visible'));
    $$('.vuln-row.expanded').forEach((r) => {
      r.classList.remove('expanded');
      r.setAttribute('aria-expanded', 'false');
    });

    if (!isExpanded) {
      detailRow.classList.add('visible');
      row.classList.add('expanded');
      row.setAttribute('aria-expanded', 'true');
      detailRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ── Sorting ──────────────────────────────────────────────────
  function initSorting() {
    $$('.vuln-table th[data-col]').forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (state.sortColumn === col) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = col;
          state.sortDir = 'asc';
        }

        $$('.vuln-table th').forEach((t) => {
          t.classList.remove('sorted');
          const icon = t.querySelector('.sort-icon');
          if (icon) icon.textContent = '↕';
        });

        th.classList.add('sorted');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = state.sortDir === 'asc' ? '↑' : '↓';

        applyFilters();
      });
    });
  }

  // ── Search & Filters ─────────────────────────────────────────
  function initFilters() {
    const searchInput = $('#search-input');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.search = e.target.value;
          applyFilters();
        }, 200);
      });
    }

    const severityFilter = $('#severity-filter');
    if (severityFilter) {
      severityFilter.addEventListener('change', (e) => {
        state.severityFilter = e.target.value;
        applyFilters();
      });
    }

    const fixableFilter = $('#fixable-filter');
    if (fixableFilter) {
      fixableFilter.addEventListener('change', (e) => {
        state.fixableFilter = e.target.value;
        applyFilters();
      });
    }

    const pageSizeSelect = $('#page-size-select');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        state.pageSize = Number(e.target.value);
        state.page = 1;
        renderTable();
        renderPagination();
      });
    }
  }

  // ── Pagination ───────────────────────────────────────────────
  function renderPagination() {
    const container = $('#pagination-controls');
    const info = $('#pagination-info');
    if (!container) return;

    const total = state.filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    const start = Math.min((state.page - 1) * state.pageSize + 1, total);
    const end = Math.min(state.page * state.pageSize, total);

    if (info) {
      info.textContent = total === 0
        ? 'No results'
        : `Showing ${start}–${end} of ${total} vulnerabilities`;
    }

    container.innerHTML = '';

    const prevBtn = makePageBtn('‹ Prev', state.page <= 1, () => {
      state.page--;
      renderTable();
      renderPagination();
    });
    container.appendChild(prevBtn);

    // Page number buttons (show up to 7)
    const pages = getPageNumbers(state.page, totalPages);
    pages.forEach((p) => {
      if (p === '…') {
        const span = document.createElement('span');
        span.textContent = '…';
        span.style.padding = '0 4px';
        span.style.color = 'var(--text-muted)';
        container.appendChild(span);
      } else {
        const btn = makePageBtn(String(p), false, () => {
          state.page = p;
          renderTable();
          renderPagination();
        });
        if (p === state.page) btn.classList.add('active');
        container.appendChild(btn);
      }
    });

    const nextBtn = makePageBtn('Next ›', state.page >= totalPages, () => {
      state.page++;
      renderTable();
      renderPagination();
    });
    container.appendChild(nextBtn);
  }

  function makePageBtn(label, disabled, onClick) {
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.textContent = label;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener('click', onClick);
    return btn;
  }

  function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
    if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', current - 1, current, current + 1, '…', total];
  }

  // ── CSV Export ───────────────────────────────────────────────
  function initExportCsv() {
    const btn = $('#export-csv-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const data = state.filtered;
      const headers = [
        'Severity', 'Package', 'Installed', 'Patched', 'Vulnerable Range',
        'CVE', 'GHSA', 'Fix Available', 'Recommendation', 'URL',
      ];
      const rows = data.map((v) => [
        v.severity,
        v.package,
        v.installedVersion,
        v.patchedVersion,
        v.vulnerableVersions,
        v.cve.join('; '),
        v.ghsa.join('; '),
        v.fixAvailable ? 'Yes' : 'No',
        v.recommendation,
        v.url,
      ].map(csvEscape).join(','));

      const csv = [headers.join(','), ...rows].join('\r\n');
      downloadFile(csv, 'audit-report.csv', 'text/csv;charset=utf-8;');
      showToast('CSV exported successfully!', 'success');
    });
  }

  function csvEscape(val) {
    const str = String(val ?? '').replace(/"/g, '""');
    return /[",\n\r]/.test(str) ? `"${str}"` : str;
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Print ────────────────────────────────────────────────────
  function initPrint() {
    const btn = $('#print-btn');
    if (btn) btn.addEventListener('click', () => window.print());
  }

  // ── Charts ───────────────────────────────────────────────────
  let charts = {};

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function chartColors() {
    return {
      critical: '#ef4444',
      high: '#f97316',
      moderate: '#eab308',
      low: '#3b82f6',
      info: '#6b7280',
      text: getCssVar('--text-secondary'),
      grid: getCssVar('--border-color'),
    };
  }

  function updateChartColors() {
    Object.values(charts).forEach((c) => {
      if (c && c.options) {
        const colors = chartColors();
        if (c.options.plugins?.legend?.labels) {
          c.options.plugins.legend.labels.color = colors.text;
        }
        c.update();
      }
    });
  }

  function initCharts() {
    if (typeof Chart === 'undefined') return;

    const report = window.REPORT_DATA;
    if (!report) return;

    const counts = report.summary?.counts || {};
    const colors = chartColors();

    const LABELS = ['Critical', 'High', 'Moderate', 'Low', 'Info'];
    const DATA = [
      counts.critical || 0,
      counts.high || 0,
      counts.moderate || 0,
      counts.low || 0,
      counts.info || 0,
    ];
    const BG_COLORS = [
      colors.critical, colors.high, colors.moderate, colors.low, colors.info,
    ];

    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.color = colors.text;

    // 1. Severity distribution (donut)
    const donutCtx = $('#chart-severity');
    if (donutCtx) {
      charts.severity = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: LABELS,
          datasets: [{ data: DATA, backgroundColor: BG_COLORS, borderWidth: 0, hoverOffset: 8 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { position: 'right', labels: { color: colors.text, padding: 16, usePointStyle: true } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
          },
        },
      });
    }

    // 2. Vulnerabilities by package (top 10, horizontal bar)
    const pkgCtx = $('#chart-packages');
    if (pkgCtx) {
      const pkgCounts = {};
      (report.vulnerabilities || []).forEach((v) => {
        pkgCounts[v.package] = (pkgCounts[v.package] || 0) + 1;
      });
      const sorted = Object.entries(pkgCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      charts.packages = new Chart(pkgCtx, {
        type: 'bar',
        data: {
          labels: sorted.map(([p]) => p),
          datasets: [{
            label: 'Vulnerabilities',
            data: sorted.map(([, c]) => c),
            backgroundColor: colors.critical,
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} vulnerabilities` } },
          },
          scales: {
            x: { grid: { color: colors.grid }, ticks: { color: colors.text, precision: 0 } },
            y: { grid: { display: false }, ticks: { color: colors.text } },
          },
        },
      });
    }

    // 3. Fixable vs Non-fixable (donut)
    const fixCtx = $('#chart-fixable');
    if (fixCtx) {
      const fixable = report.summary?.fixable || 0;
      const nonFixable = report.summary?.nonFixable || 0;
      charts.fixable = new Chart(fixCtx, {
        type: 'doughnut',
        data: {
          labels: ['Fixable', 'Non-fixable'],
          datasets: [{
            data: [fixable, nonFixable],
            backgroundColor: ['#10b981', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { position: 'right', labels: { color: colors.text, usePointStyle: true } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
          },
        },
      });
    }

    // 4. History trend chart
    const histCtx = $('#chart-history');
    if (histCtx && Array.isArray(window.HISTORY_DATA) && window.HISTORY_DATA.length > 1) {
      const history = window.HISTORY_DATA;
      charts.history = new Chart(histCtx, {
        type: 'line',
        data: {
          labels: history.map((h) => new Date(h.timestamp).toLocaleDateString()),
          datasets: [
            {
              label: 'Critical',
              data: history.map((h) => h.summary?.counts?.critical || 0),
              borderColor: colors.critical,
              backgroundColor: 'rgba(239,68,68,0.08)',
              tension: 0.4, fill: true, pointRadius: 4,
            },
            {
              label: 'High',
              data: history.map((h) => h.summary?.counts?.high || 0),
              borderColor: colors.high,
              backgroundColor: 'rgba(249,115,22,0.08)',
              tension: 0.4, fill: true, pointRadius: 4,
            },
            {
              label: 'Total',
              data: history.map((h) => h.summary?.total || 0),
              borderColor: colors.low,
              backgroundColor: 'rgba(59,130,246,0.08)',
              tension: 0.4, fill: false, pointRadius: 4,
              borderDash: [4, 4],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: colors.text, usePointStyle: true } },
          },
          scales: {
            x: { grid: { color: colors.grid }, ticks: { color: colors.text } },
            y: { grid: { color: colors.grid }, ticks: { color: colors.text, precision: 0 } },
          },
        },
      });
    }
  }

  // ── Keyboard navigation ──────────────────────────────────────
  function initKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $$('.detail-row.visible').forEach((r) => r.classList.remove('visible'));
        $$('.vuln-row.expanded').forEach((r) => {
          r.classList.remove('expanded');
          r.setAttribute('aria-expanded', 'false');
        });
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const searchInput = $('#search-input');
        if (searchInput && document.activeElement !== searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }
    });
  }

  // ── Animate count-up on summary cards ───────────────────────
  function initCountUp() {
    $$('.summary-card-count[data-count]').forEach((el) => {
      const target = parseInt(el.dataset.count, 10);
      if (isNaN(target) || target === 0) { el.textContent = '0'; return; }
      const duration = 800;
      const start = performance.now();
      function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(ease * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ── Bootstrap ────────────────────────────────────────────────
  function init() {
    initTheme();
    initData();
    initFilters();
    initSorting();
    initTableInteractivity();
    renderPagination();
    initExportCsv();
    initPrint();
    initCopyButtons();
    initKeyboardNav();
    initCountUp();
    // Charts init after a tick so the canvas sizes are computed
    setTimeout(initCharts, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
