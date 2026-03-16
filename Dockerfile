# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests and install all deps (including dev) for compilation
COPY package.json ./
RUN npm install

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production image ───────────────────────────────────────────────────
FROM node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Copy package manifest and install production deps only
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled output from the builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
