# Task ID: 10

**Title:** Implement Media Processing and Docker Deployment

**Status:** pending

**Dependencies:** 7, 9

**Priority:** medium

**Description:** Add thumbnail generation with Sharp, implement on-demand media fetching endpoint, create Docker Compose setup for all services (PostgreSQL, Redis, API, Web), and write deployment documentation.

**Details:**

1. Create apps/api/src/modules/crawler/media.service.ts:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly thumbnailDir = path.join(process.cwd(), 'storage', 'thumbnails');

  constructor(private telegramService: TelegramService) {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    await fs.mkdir(this.thumbnailDir, { recursive: true });
  }

  async generateThumbnail(buffer: Buffer, fileId: string): Promise<string> {
    try {
      const thumbnailPath = path.join(this.thumbnailDir, `${fileId}.jpg`);
      
      await sharp(buffer)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
      
      return `/thumbnails/${fileId}.jpg`;
    } catch (error) {
      this.logger.error(`Failed to generate thumbnail for ${fileId}`, error);
      throw error;
    }
  }

  async getThumbnailPath(fileId: string): Promise<string | null> {
    const thumbnailPath = path.join(this.thumbnailDir, `${fileId}.jpg`);
    try {
      await fs.access(thumbnailPath);
      return thumbnailPath;
    } catch {
      return null;
    }
  }

  async cleanupOldThumbnails(maxAgeHours = 24) {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    try {
      const files = await fs.readdir(this.thumbnailDir);
      
      for (const file of files) {
        const filePath = path.join(this.thumbnailDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          this.logger.log(`Deleted old thumbnail: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup thumbnails', error);
    }
  }
}
```

2. Update CrawlChannelProcessor to generate thumbnails:
```typescript
// In apps/api/src/modules/crawler/jobs/crawl-channel.job.ts
// Add MediaService injection and thumbnail generation for photos

constructor(
  private telegramService: TelegramService,
  private mediaService: MediaService,
  @InjectRepository(Channel)
  private channelsRepository: Repository<Channel>,
  @InjectRepository(Post)
  private postsRepository: Repository<Post>,
) {
  super();
}

// After saving post with media, generate thumbnail:
if (msg.hasMedia && msg.mediaType === 'photo' && msg.mediaFileId) {
  try {
    const buffer = await this.telegramService.downloadMedia(msg.mediaFileId, 'photo');
    const thumbnailUrl = await this.mediaService.generateThumbnail(buffer, msg.mediaFileId);
    post.mediaThumbnail = thumbnailUrl;
    await this.postsRepository.save(post);
  } catch (error) {
    this.logger.warn(`Failed to generate thumbnail for post ${post.id}`, error);
  }
}
```

3. Add static file serving in apps/api/src/main.ts:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors();
  
  // Serve static thumbnails
  app.use('/thumbnails', express.static(path.join(process.cwd(), 'storage', 'thumbnails')));
  
  await app.listen(3001);
  console.log('API running on http://localhost:3001');
}
bootstrap();
```

4. Create docker-compose.yml in project root:
```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: telegram_crawler
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: telegram_crawler
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U telegram_crawler"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: telegram_crawler
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: telegram_crawler
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      TELEGRAM_API_ID: ${TELEGRAM_API_ID}
      TELEGRAM_API_HASH: ${TELEGRAM_API_HASH}
      TELEGRAM_SESSION_STRING: ${TELEGRAM_SESSION_STRING}
      NODE_ENV: production
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - api_storage:/app/storage
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: ./apps/web/Dockerfile
    environment:
      NUXT_PUBLIC_API_BASE: http://localhost:3001/api
    ports:
      - "3000:3000"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  api_storage:
```

5. Create apps/api/Dockerfile:
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @telegram-crawler/api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages ./packages
COPY apps/api/package.json ./apps/api/
RUN mkdir -p /app/storage/thumbnails
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
```

6. Create apps/web/Dockerfile:
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @telegram-crawler/web build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.output /app/.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

7. Create .env.example in root:
```
DB_PASSWORD=your_secure_password
REDIS_PASSWORD=your_redis_password
JWT_ACCESS_SECRET=your_jwt_access_secret_min_32_characters
JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_characters
TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash
TELEGRAM_SESSION_STRING=your_session_string
```

8. Create DEPLOYMENT.md:
```markdown
# Deployment Guide

## Prerequisites
- Docker and Docker Compose installed
- Telegram API credentials (api_id, api_hash from https://my.telegram.org)
- Telegram session string (generate using authentication script)

## Setup Steps

1. Clone repository and navigate to project root

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit .env and fill in all required values

4. Generate Telegram session:
   ```bash
   cd apps/api
   pnpm tsx scripts/generate-session.ts
   ```
   Follow prompts to authenticate and copy session string to .env

5. Build and start services:
   ```bash
   docker-compose up -d
   ```

6. Run database migrations:
   ```bash
   docker-compose exec api pnpm typeorm migration:run
   ```

7. Create initial admin user:
   ```bash
   docker-compose exec api pnpm tsx scripts/create-admin.ts
   ```

8. Access application:
   - Frontend: http://localhost:3000
   - API: http://localhost:3001

## Monitoring

- View logs: `docker-compose logs -f`
- View API logs: `docker-compose logs -f api`
- View crawler jobs: Access BullMQ dashboard (optional addon)

## Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U telegram_crawler telegram_crawler > backup.sql

# Backup thumbnails
tar -czf thumbnails.tar.gz storage/thumbnails/
```

## Troubleshooting

- If Telegram client fails to connect, verify session string is valid
- Check FLOOD_WAIT errors in logs and adjust crawler frequency
- Ensure PostgreSQL full-text search indexes are created
```

9. Create apps/api/scripts/generate-session.ts:
```typescript
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function main() {
  const apiId = parseInt(await question('Enter API ID: '));
  const apiHash = await question('Enter API Hash: ');
  const phoneNumber = await question('Enter phone number: ');

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => phoneNumber,
    password: async () => await question('Enter password (if 2FA enabled): '),
    phoneCode: async () => await question('Enter code from Telegram: '),
    onError: (err) => console.error(err),
  });

  console.log('\nAuthentication successful!');
  console.log('\nSession string:');
  console.log(client.session.save());
  console.log('\nCopy this to TELEGRAM_SESSION_STRING in .env file\n');

  await client.disconnect();
  rl.close();
}

main();
```

**Test Strategy:**

1. Unit tests for MediaService:
   - generateThumbnail creates 200x200 JPEG
   - getThumbnailPath returns correct path or null
   - cleanupOldThumbnails deletes files older than maxAge
2. Integration test:
   - Upload test image buffer
   - Verify thumbnail generated
   - Verify thumbnail accessible via HTTP
3. Docker deployment test:
   - Build all images successfully
   - docker-compose up starts all services
   - Health checks pass for postgres and redis
   - API accessible at http://localhost:3001
   - Web accessible at http://localhost:3000
4. Migration test:
   - Run migrations in Docker container
   - Verify all tables created
   - Verify full-text search indexes exist
5. E2E deployment test:
   - Deploy with docker-compose
   - Login to web app
   - Add channel
   - Wait for crawl job
   - Verify posts appear in feed
   - Verify thumbnails load
6. Backup/restore test:
   - Create backup
   - Destroy volumes
   - Restore backup
   - Verify data intact

## Subtasks

### 10.1. Create MediaService with Sharp for thumbnail generation

**Status:** pending  
**Dependencies:** None  

Implement MediaService class with Sharp library for generating 200x200 JPEG thumbnails from image buffers with proper error handling and logging.

**Details:**

Create apps/api/src/modules/crawler/media.service.ts with MediaService class. Implement generateThumbnail method that uses Sharp to resize images to 200x200 with fit: 'cover', converts to JPEG with 80% quality, and saves to storage/thumbnails directory. Include error handling with Logger for failed thumbnail generation. Method should return relative URL path /thumbnails/{fileId}.jpg for use in database.

### 10.2. Implement thumbnail storage and cleanup logic

**Status:** pending  
**Dependencies:** 10.1  

Add directory initialization, thumbnail path resolution, and automated cleanup of old thumbnails based on configurable age threshold.

**Details:**

In MediaService, implement ensureDirectories() to create storage/thumbnails directory recursively. Add getThumbnailPath() method that checks if thumbnail exists using fs.access and returns file path or null. Implement cleanupOldThumbnails(maxAgeHours = 24) that reads thumbnailDir, iterates files, checks mtime, and deletes files older than maxAge. Include comprehensive error handling and logging for cleanup failures.

### 10.3. Add static file serving to NestJS main.ts

**Status:** pending  
**Dependencies:** 10.2  

Configure Express static middleware to serve thumbnail images from storage/thumbnails directory at /thumbnails URL path.

**Details:**

Update apps/api/src/main.ts to import express and path modules. After CORS setup and before app.listen(), add app.use('/thumbnails', express.static(path.join(process.cwd(), 'storage', 'thumbnails'))). This enables direct HTTP access to generated thumbnails via GET /thumbnails/{fileId}.jpg URLs.

### 10.4. Integrate thumbnail generation into crawler job

**Status:** pending  
**Dependencies:** 10.3  

Update CrawlChannelProcessor to inject MediaService and generate thumbnails for photo posts during crawling process.

**Details:**

In apps/api/src/modules/crawler/jobs/crawl-channel.job.ts, add MediaService to constructor injection. After saving post with mediaType === 'photo' and mediaFileId, call telegramService.downloadMedia() to get buffer, then mediaService.generateThumbnail() to create thumbnail. Update post.mediaThumbnail field with returned URL and save. Wrap in try-catch to log warnings without failing entire crawl if thumbnail generation fails.

### 10.5. Create Dockerfile for API with multi-stage build

**Status:** pending  
**Dependencies:** None  

Build optimized production Docker image for NestJS API using multi-stage build pattern with pnpm workspace support and minimal runtime dependencies.

**Details:**

Create apps/api/Dockerfile with 4 stages: base (node:20-alpine with pnpm), deps (install dependencies with frozen lockfile), builder (build TypeScript), runner (production runtime). Copy only necessary files at each stage. Configure NODE_ENV=production. Create /app/storage/thumbnails directory for volume mounting. Expose port 3001 and set CMD to node apps/api/dist/main.js. Use --frozen-lockfile for deterministic builds.

### 10.6. Create Dockerfile for Web with Nuxt build optimization

**Status:** pending  
**Dependencies:** None  

Build production Docker image for Nuxt.js web application with optimized SSR output and minimal runtime footprint.

**Details:**

Create apps/web/Dockerfile with 4 stages: base (node:20-alpine with pnpm), deps (install frozen lockfile), builder (run nuxt build), runner (copy .output and serve). Set NODE_ENV=production in runner stage. Copy only apps/web/.output directory to minimize image size. Expose port 3000. Set CMD to node .output/server/index.mjs for Nuxt SSR server.

### 10.7. Write docker-compose.yml with all services

**Status:** pending  
**Dependencies:** 10.5, 10.6  

Create comprehensive Docker Compose configuration orchestrating PostgreSQL, Redis, API, and Web services with proper networking and volume management.

**Details:**

Create docker-compose.yml version 3.9 in project root. Define 4 services: postgres (postgres:16-alpine), redis (redis:7-alpine with password auth), api (build from apps/api/Dockerfile), web (build from apps/web/Dockerfile). Configure environment variables using ${VAR} substitution from .env file. Define named volumes: postgres_data, redis_data, api_storage for persistence. Map ports: postgres:5432, redis:6379, api:3001, web:3000.

### 10.8. Configure service dependencies and health checks

**Status:** pending  
**Dependencies:** 10.7  

Implement health checks for database services and configure service startup dependencies to ensure proper initialization order.

**Details:**

Add healthcheck to postgres service: pg_isready -U telegram_crawler with 10s interval, 5s timeout, 5 retries. Add healthcheck to redis: redis-cli --raw incr ping with same timing. Configure api service with depends_on using condition: service_healthy for both postgres and redis. Set restart: unless-stopped for api and web services. Configure web depends_on api without health check condition.

### 10.9. Create environment configuration and example file

**Status:** pending  
**Dependencies:** None  

Define all required environment variables for production deployment and create .env.example template with documentation.

**Details:**

Create .env.example in project root with all required variables: DB_PASSWORD, REDIS_PASSWORD, JWT_ACCESS_SECRET (min 32 chars), JWT_REFRESH_SECRET (min 32 chars), TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_STRING. Add comments explaining where to obtain each value (e.g., Telegram credentials from my.telegram.org). Include placeholder values showing expected format but not actual secrets.

### 10.10. Write Telegram session generation script

**Status:** pending  
**Dependencies:** None  

Create interactive CLI script for authenticating with Telegram and generating session string required for GramJS client initialization.

**Details:**

Create apps/api/scripts/generate-session.ts using TelegramClient and StringSession from telegram library. Implement readline interface for interactive prompts: API ID, API Hash, phone number, password (if 2FA), and phone code. Use client.start() with async prompt callbacks. On successful auth, output client.session.save() session string with instructions to copy to TELEGRAM_SESSION_STRING in .env. Include error handling and connection retry configuration (connectionRetries: 5).

### 10.11. Create comprehensive deployment documentation

**Status:** pending  
**Dependencies:** 10.8, 10.9, 10.10  

Write complete DEPLOYMENT.md guide covering prerequisites, setup steps, monitoring, backup procedures, and troubleshooting for production deployment.

**Details:**

Create DEPLOYMENT.md in project root with sections: Prerequisites (Docker, Docker Compose, Telegram credentials), Setup Steps (clone repo, copy .env, generate session, docker-compose up, run migrations, create admin user, access URLs), Monitoring (docker-compose logs commands), Backup (pg_dump for database, tar for thumbnails), Troubleshooting (Telegram session errors, FLOOD_WAIT handling, database index verification). Include exact commands with syntax highlighting. Reference session generation script and migration execution in Docker context.
