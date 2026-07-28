FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine
LABEL org.opencontainers.image.title="npm-audit-html-report"
LABEL org.opencontainers.image.description="Generate interactive HTML security reports from npm audit"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

VOLUME ["/project", "/reports"]
WORKDIR /project

ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["--output", "/reports", "--theme", "dark"]
