# npm-audit-html-report

> **Generate modern, interactive HTML security reports from `npm audit` output.**

[![npm version](https://img.shields.io/npm/v/npm-audit-html-report.svg?style=flat-square)](https://www.npmjs.com/package/npm-audit-html-report)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

---

## ✨ Features

- 🔐 Runs `npm audit --json` and normalizes v6 **and** v7+ output formats
- 📊 Rich interactive dashboard with Chart.js charts
- 🌗 Light / Dark theme (auto-detects `prefers-color-scheme`)
- 🔍 Real-time search, column sorting, severity / fixability filters
- 📄 Pagination + CSV export
- 📜 Expandable detail rows with dependency path, CVE/GHSA links, copy-to-clipboard fix commands
- 📈 History mode — trend chart and new/fixed vulnerability diff between scans
- 🖨 Print-friendly stylesheet
- 📑 Optional PDF generation (via Puppeteer)
- 🚀 Opens report in default browser (`--open`)
- ⚙️ CI-friendly `--fail-on` threshold exit codes

---

## 📦 Installation

### Global (permanent install)

```bash
npm install -g npm-audit-html-report
```

### Run without installing

```bash
npx npm-audit-html-report
```

---

## 🚀 Usage

Run from the root of any Node.js project:

```bash
# Basic — full audit
audit-report

# Production dependencies only
audit-report --production

# Dark theme with custom title
audit-report --theme dark --title "My App Security Report"

# Save to a custom directory
audit-report --output reports

# Fail CI if any high or critical vulnerabilities are found
audit-report --fail-on high

# Enable history mode (stores .history/  directory)
audit-report --history

# Generate a PDF alongside the HTML (requires puppeteer)
audit-report --pdf

# Open the report in the browser automatically
audit-report --open

# Output normalized JSON to stdout (no HTML)
audit-report --json

# Full example
audit-report \
  --production \
  --output reports \
  --theme dark \
  --title "Security Report" \
  --fail-on high \
  --history \
  --open
```

---

## ⚙️ CLI Options

| Option | Default | Description |
|---|---|---|
| `-o, --output <dir>` | `reports` | Directory to save the generated report |
| `-p, --production` | `false` | Audit production dependencies only (`--omit=dev`) |
| `-j, --json` | `false` | Print normalized JSON to stdout instead of generating HTML |
| `--pdf` | `false` | Generate a PDF report (requires `puppeteer`) |
| `-t, --theme <theme>` | `dark` | UI theme: `light` or `dark` |
| `--title <title>` | `Security Audit Report` | Custom report heading |
| `--fail-on <severity>` | — | Exit code 1 if vulnerabilities ≥ this severity exist |
| `--open` | `false` | Open the report in the default browser |
| `--history` | `false` | Enable scan history (stored in `.history/`) |
| `-v, --version` | — | Print the CLI version |
| `-h, --help` | — | Display help |

### Severity levels (for `--fail-on`)

`critical` › `high` › `moderate` › `low` › `info`

### Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success — no vulnerabilities above threshold |
| `1` | Vulnerability threshold exceeded (`--fail-on`) |
| `2` | Execution error (npm not found, parse error, write error) |

---

## 🗂 Architecture

```
src/
├── cli.ts                   CLI entry point (Commander)
├── audit/
│   ├── auditRunner.ts       Spawns npm audit, captures JSON
│   └── auditParser.ts       Normalizes v6/v7 JSON → internal models
├── report/
│   ├── htmlBuilder.ts       Compiles Handlebars template, inlines assets
│   ├── reportGenerator.ts   Writes HTML/PDF, opens browser
│   └── templates/
│       └── report.hbs       Handlebars HTML template
├── history/
│   └── historyManager.ts    Loads/saves .history/*.json entries
├── models/
│   └── audit.ts             TypeScript interfaces
├── utils/
│   ├── colors.ts            Chalk console helpers
│   ├── date.ts              Date formatting
│   ├── file.ts              fs/promises wrappers
│   └── severity.ts          Severity ordering, colors, threshold
└── assets/
    ├── style.css            Full responsive CSS (inlined into report)
    └── report.js            Vanilla JS frontend (inlined into report)
```

---

## 🏗 Development

```bash
# Clone the repo
git clone https://github.com/your-org/npm-audit-html-report.git
cd npm-audit-html-report

# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run build:watch

# Lint
npm run lint

# Format
npm run format

# Run against your own project
node dist/cli.js --output reports --theme dark
```

---

## 🐳 Docker

```dockerfile
FROM node:22-alpine
RUN npm install -g npm-audit-html-report
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
ENTRYPOINT ["audit-report"]
```

```bash
docker build -t audit-report .
docker run --rm -v $(pwd):/app audit-report --output /app/reports
```

---

## 🔖 PDF Generation

PDF output requires [Puppeteer](https://pptr.dev/):

```bash
npm install puppeteer   # downloads Chromium (~170 MB)
audit-report --pdf
```

---

## 📤 Publishing to npm

```bash
# Ensure clean build
npm run prepublishOnly

# Publish
npm publish --access public
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

Please run `npm run lint` and `npm run format` before submitting.

---

## 📄 License

[MIT](./LICENSE) © npm-audit-html-report contributors
