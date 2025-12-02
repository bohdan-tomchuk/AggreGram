# Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- Telegram API credentials (api_id, api_hash from https://my.telegram.org)
- Telegram session string (generate using authentication script)

## Setup Steps

### 1. Clone repository and navigate to project root

```bash
git clone <repository-url>
cd AggreGram
```

### 2. Copy environment file

```bash
cp .env.example .env
```

### 3. Edit .env and fill in all required values

Open `.env` in your editor and configure:

- `DB_PASSWORD`: A secure password for PostgreSQL
- `REDIS_PASSWORD`: A secure password for Redis
- `JWT_ACCESS_SECRET`: Random string (minimum 32 characters) for access tokens
- `JWT_REFRESH_SECRET`: Random string (minimum 32 characters) for refresh tokens
- `TELEGRAM_API_ID`: Your Telegram API ID from https://my.telegram.org
- `TELEGRAM_API_HASH`: Your Telegram API Hash from https://my.telegram.org
- `TELEGRAM_SESSION_STRING`: Generate in the next step

### 4. Generate Telegram session

```bash
cd apps/api
pnpm install
pnpm tsx scripts/generate-session.ts
```

Follow the prompts to authenticate:
1. Enter your Telegram API ID and Hash (from step 3)
2. Enter your phone number with country code (e.g., +1234567890)
3. Enter the verification code sent to your Telegram app
4. If you have 2FA enabled, enter your password
5. Copy the session string and add it to `TELEGRAM_SESSION_STRING` in `.env`

### 5. Build and start services

```bash
cd ../..  # Return to project root
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Redis on port 6379
- API server on port 3001

### 6. Run database migrations

```bash
docker-compose exec api pnpm typeorm migration:run
```

### 7. Access application

- API: http://localhost:3001
- API Health: http://localhost:3001/api/health (if implemented)

## Managing the Application

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Stop services

```bash
docker-compose down
```

### Stop services and remove volumes (⚠️ This will delete all data)

```bash
docker-compose down -v
```

### Restart a service

```bash
docker-compose restart api
```

## Monitoring

### Check service status

```bash
docker-compose ps
```

### View crawler jobs

The API uses BullMQ for background job processing. To monitor crawler jobs, you can:

1. Add BullBoard (optional) to your API for a web-based dashboard
2. Use Redis CLI to inspect job queues:

```bash
docker-compose exec redis redis-cli -a $REDIS_PASSWORD
> KEYS bull:crawl:*
```

## Backup

### Backup database

```bash
docker-compose exec postgres pg_dump -U telegram_crawler telegram_crawler > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore database

```bash
cat backup_YYYYMMDD_HHMMSS.sql | docker-compose exec -T postgres psql -U telegram_crawler telegram_crawler
```

### Backup thumbnails

```bash
docker-compose exec api tar -czf - /app/storage/thumbnails > thumbnails_$(date +%Y%m%d_%H%M%S).tar.gz
```

### Restore thumbnails

```bash
cat thumbnails_YYYYMMDD_HHMMSS.tar.gz | docker-compose exec -T api tar -xzf - -C /
```

## Troubleshooting

### Telegram client fails to connect

**Symptom**: API logs show connection errors to Telegram

**Solutions**:
1. Verify `TELEGRAM_SESSION_STRING` is correctly copied to `.env`
2. Regenerate session string if it's expired:
   ```bash
   cd apps/api
   pnpm tsx scripts/generate-session.ts
   ```
3. Check Telegram API credentials are valid at https://my.telegram.org

### FLOOD_WAIT errors

**Symptom**: Logs show `FLOOD_WAIT_X` errors

**Explanation**: Telegram rate-limits API requests to prevent abuse.

**Solutions**:
1. The crawler will automatically retry after the specified wait time
2. Reduce crawler frequency by adjusting channel crawl intervals
3. If persistent, add delays between requests in `TelegramService`

### Database connection errors

**Symptom**: API can't connect to PostgreSQL

**Solutions**:
1. Verify PostgreSQL is healthy:
   ```bash
   docker-compose ps postgres
   ```
2. Check database credentials match in `.env` and `docker-compose.yml`
3. View PostgreSQL logs:
   ```bash
   docker-compose logs postgres
   ```

### Redis connection errors

**Symptom**: BullMQ jobs fail to process

**Solutions**:
1. Verify Redis is healthy:
   ```bash
   docker-compose ps redis
   ```
2. Test Redis connection:
   ```bash
   docker-compose exec redis redis-cli -a $REDIS_PASSWORD ping
   ```
3. Check `REDIS_PASSWORD` matches in `.env`

### Full-text search not working

**Symptom**: Post search returns no results

**Solution**: Verify full-text search indexes were created during migration:

```bash
docker-compose exec postgres psql -U telegram_crawler telegram_crawler -c "SELECT tablename, indexname FROM pg_indexes WHERE indexname LIKE '%search%';"
```

### Thumbnails not generating

**Symptom**: Posts have `mediaThumbnail: null`

**Solutions**:
1. Check Sharp library is installed in Docker container
2. Verify storage directory exists and is writable:
   ```bash
   docker-compose exec api ls -la /app/storage
   ```
3. Check API logs for thumbnail generation errors:
   ```bash
   docker-compose logs api | grep thumbnail
   ```

### Port conflicts

**Symptom**: Docker Compose fails with "port already allocated"

**Solution**: Change port mappings in `docker-compose.yml`:

```yaml
services:
  api:
    ports:
      - "3002:3001"  # Change host port from 3001 to 3002
```

## Production Recommendations

1. **Use secrets management**: Store sensitive credentials in Docker secrets or environment management tools
2. **Enable SSL/TLS**: Use a reverse proxy (nginx, Traefik) for HTTPS
3. **Regular backups**: Automate database and thumbnail backups with cron
4. **Monitor resources**: Use Docker stats or monitoring tools to track resource usage
5. **Log aggregation**: Consider using ELK stack or similar for centralized logging
6. **Update regularly**: Keep Docker images and dependencies up to date
7. **Resource limits**: Add memory and CPU limits to services in `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
```

## Scaling

### Horizontal scaling of crawler

Increase BullMQ worker concurrency:

```typescript
// In apps/api/src/modules/crawler/jobs/crawl-channel.job.ts
@Processor('crawl', { concurrency: 5 })  // Increase from 2 to 5
```

### Multiple API instances

Use Docker Compose scale:

```bash
docker-compose up -d --scale api=3
```

Add a load balancer (nginx) in front of API instances.

## Support

For issues and questions:
- Check logs: `docker-compose logs`
- Review Telegram API docs: https://core.telegram.org/api
- Check GramJS docs: https://gram.js.org
