# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests and install all deps (including dev) for compilation
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema and generate the client before compiling TypeScript
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production image ───────────────────────────────────────────────────
FROM node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Copy package manifest and install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the generated Prisma client (output is written inside src/generated/prisma)
COPY --from=builder /app/src/generated ./src/generated

# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
