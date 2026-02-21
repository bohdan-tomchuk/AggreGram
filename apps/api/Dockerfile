# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

# node-gyp dependencies (for bcrypt, tdl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/ ./packages/types/

# Copy api package.json for dep resolution
COPY apps/api/package.json ./apps/api/

# Install all deps (including devDeps for TypeScript build)
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY apps/api/ ./apps/api/

RUN cd apps/api && pnpm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy node_modules from builder (includes native binaries already compiled)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/types/ ./packages/types/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy built output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy package files (needed for module resolution)
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/

WORKDIR /app/apps/api

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/main.js"]
