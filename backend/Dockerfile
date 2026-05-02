# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for safety
RUN addgroup -S agriplan && adduser -S agriplan -G agriplan

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remove dev/deploy artefacts from the image
RUN rm -rf deploy .env.example .env

USER agriplan

EXPOSE 4500

CMD ["node", "server.js"]
