FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

# Build
COPY . .
RUN pnpm --filter api build

# Create storage dir
RUN mkdir -p /app/storage/thumbnails

WORKDIR /app/apps/api

# Copy and set up start script
COPY apps/api/start.sh ./
RUN chmod +x start.sh

EXPOSE 3001
CMD ["./start.sh"]