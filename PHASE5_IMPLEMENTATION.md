# Phase 5: Message Fetching & Forwarding - Implementation Summary

## ✅ Completed Backend Tasks

### 1. Database Schema
- ✅ Created `AggregationJob` entity with status tracking
- ✅ Generated and ran migration `CreateAggregationJobsTable`
- ✅ Added entity to `database.module.ts` and `data-source.ts`

**Files Created/Modified:**
- `apps/api/src/modules/feeds/entities/aggregation-job.entity.ts`
- `apps/api/src/database/migrations/1771075883484-CreateAggregationJobsTable.ts`
- `apps/api/src/database/database.module.ts`
- `apps/api/src/database/data-source.ts`

### 2. TdlibService Extensions
- ✅ Added `getChatHistory()` method for fetching messages from channels
- ✅ Added `forwardMessage()` method using Bot API for message forwarding

**Files Modified:**
- `apps/api/src/modules/telegram/services/tdlib.service.ts`

### 3. Queue Service Extensions
- ✅ Added `fetchQueue` for message fetching jobs
- ✅ Added `postQueue` for message posting jobs
- ✅ Added `enqueueFetchJob()` method
- ✅ Added `enqueuePostJob()` method
- ✅ Configured rate limiting and retry logic

**Files Modified:**
- `apps/api/src/modules/queue/queue.service.ts`

### 4. Job Processors
- ✅ Created `FetchProcessor` for fetching messages from source channels
  - Handles checkpoint tracking (`lastMessageId`)
  - Filters valid messages
  - Creates aggregation job records
  - Enqueues post jobs when messages are found

- ✅ Created `PostProcessor` for forwarding messages to feed channels
  - Uses bot token to forward messages via Bot API
  - Updates checkpoint after each message
  - Tracks messages posted count
  - Handles rate limiting with delays

**Files Created:**
- `apps/api/src/modules/queue/processors/fetch.processor.ts`
- `apps/api/src/modules/queue/processors/post.processor.ts`

### 5. Scheduler Service
- ✅ Created `SchedulerService` for managing recurring jobs
- ✅ Schedules all active feeds on module initialization
- ✅ Methods: `scheduleFeed()`, `unscheduleFeed()`, `rescheduleFeed()`
- ✅ Uses BullMQ repeatable jobs

**Files Created:**
- `apps/api/src/modules/queue/scheduler.service.ts`

### 6. Feeds Service Extensions
- ✅ Added `syncFeed()` - Manual feed synchronization
- ✅ Added `pauseFeed()` - Pause recurring sync
- ✅ Added `resumeFeed()` - Resume recurring sync
- ✅ Added `getJobs()` - Get aggregation job history
- ✅ Injected `SchedulerService` and `AggregationJob` repository

**Files Modified:**
- `apps/api/src/modules/feeds/feeds.service.ts`
- `apps/api/src/modules/feeds/feeds.module.ts`

### 7. Feeds Controller Endpoints
- ✅ `POST /feeds/:id/sync` - Trigger manual sync
- ✅ `POST /feeds/:id/pause` - Pause feed
- ✅ `POST /feeds/:id/resume` - Resume feed
- ✅ `GET /feeds/:id/jobs` - Get job history

**Files Modified:**
- `apps/api/src/modules/feeds/feeds.controller.ts`

### 8. Feed Status Management
- ✅ Created `FeedStatus` enum (DRAFT, ACTIVE, PAUSED, ERROR)
- ✅ Updated `Feed` entity to use enum
- ✅ Updated all services and processors to use enum
- ✅ Channel creation now sets status to ACTIVE and schedules recurring sync

**Files Modified:**
- `apps/api/src/modules/feeds/entities/feed.entity.ts`
- `apps/api/src/modules/queue/processors/channel.processor.ts`

### 9. Module Configuration
- ✅ Updated `QueueModule` to include all processors and scheduler
- ✅ Updated `FeedsModule` to include AggregationJob entity
- ✅ Installed `@nestjs/bullmq` package

**Files Modified:**
- `apps/api/src/modules/queue/queue.module.ts`
- `apps/api/package.json`

---

## 🏗️ Architecture Overview

### Message Flow

```
1. Scheduler → FetchQueue (recurring job every polling_interval_sec)
2. FetchProcessor:
   - Fetches messages from all source channels
   - Tracks checkpoint (lastMessageId) per source
   - Creates AggregationJob record
   - Enqueues PostJob if messages found
3. PostProcessor:
   - Forwards messages to feed channel via bot
   - Updates checkpoint after each message
   - Marks AggregationJob as completed
```

### Job Types

- **Fetch Job**: `fetch-feed-sources`
  - Data: `{ feedId, userId, jobId? }`
  - Concurrency: 5
  - Retries: 3 with exponential backoff

- **Post Job**: `post-to-feed`
  - Data: `{ feedId, userId, messages[], jobId }`
  - Concurrency: 3
  - Retries: 3 with exponential backoff
  - Rate limit: 1s delay between messages

### State Transitions

```
Feed Status:
DRAFT → ACTIVE (on channel creation)
ACTIVE ↔ PAUSED (on pause/resume)
ANY → ERROR (on critical failure)

AggregationJob Status:
PENDING → RUNNING → COMPLETED
         ↓
       FAILED (with error_message)
```

---

## 📊 Database Schema

### aggregation_jobs Table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| feed_id | uuid | Foreign key to feeds |
| status | enum | pending/running/completed/failed |
| messages_fetched | int | Count of messages fetched |
| messages_posted | int | Count of messages posted |
| error_message | text | Error details if failed |
| started_at | timestamp | Job start time |
| completed_at | timestamp | Job completion time |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Record update time |

---

## 🔧 Configuration

### Queue Settings

**Fetch Queue:**
- Name: `fetch-queue`
- Max retries: 3
- Backoff: Exponential, 5s initial delay

**Post Queue:**
- Name: `post-queue`
- Max retries: 3
- Backoff: Exponential, 3s initial delay
- Message delay: 1s between forwards

### Scheduler

- Initializes on module start
- Schedules all active feeds automatically
- Job ID pattern: `recurring-fetch-{feedId}`

---

## 🧪 Testing Checklist

### Backend API Tests

- [ ] **Manual Sync**
  ```bash
  POST /feeds/:id/sync
  # Should enqueue fetch job
  # Should return job ID
  ```

- [ ] **Pause Feed**
  ```bash
  POST /feeds/:id/pause
  # Should set status to PAUSED
  # Should unschedule recurring job
  ```

- [ ] **Resume Feed**
  ```bash
  POST /feeds/:id/resume
  # Should set status to ACTIVE
  # Should schedule recurring job
  ```

- [ ] **Get Jobs**
  ```bash
  GET /feeds/:id/jobs
  # Should return recent aggregation jobs
  # Should show status, messages_fetched, messages_posted
  ```

### Job Processing Tests

- [ ] **FetchProcessor**
  - Creates AggregationJob record
  - Fetches messages from source channels
  - Tracks lastMessageId checkpoint
  - Filters invalid/duplicate messages
  - Enqueues post job when messages found
  - Marks job completed if no messages

- [ ] **PostProcessor**
  - Forwards messages to feed channel
  - Updates lastMessageId after each message
  - Counts messages posted
  - Handles errors gracefully
  - Marks job completed

### Scheduler Tests

- [ ] **Initialization**
  - Schedules all active feeds on startup
  - Uses correct polling interval per feed

- [ ] **Feed Lifecycle**
  - New active feed gets scheduled
  - Paused feed gets unscheduled
  - Resumed feed gets rescheduled
  - Deleted feed gets unscheduled

### Integration Tests

- [ ] **End-to-End Flow**
  1. Create feed with sources
  2. Create channel (should auto-schedule)
  3. Wait for polling interval
  4. Verify messages appear in Telegram channel
  5. Verify aggregation_jobs record created
  6. Verify checkpoint updated

- [ ] **Pause/Resume**
  1. Active feed with messages
  2. Pause feed
  3. Verify no new syncs occur
  4. Resume feed
  5. Verify syncs restart

- [ ] **Error Handling**
  1. Simulate bot revoked
  2. Verify job marked as failed
  3. Verify error_message populated
  4. Verify feed status NOT changed to ERROR (unless critical)

---

## 🚀 Deployment Steps

1. **Run Migration**
   ```bash
   cd apps/api
   pnpm migration:run
   ```

2. **Verify Redis Connection**
   ```bash
   docker ps | grep aggregram-redis
   ```

3. **Restart API**
   ```bash
   pnpm dev
   ```

4. **Monitor Logs**
   ```bash
   # Watch for:
   # - "Feed scheduler initialized"
   # - "Scheduled feed {id} for polling every {interval}s"
   # - "Processing fetch job..."
   # - "Processing post job..."
   ```

5. **Check BullMQ Dashboard** (optional)
   - Install: `pnpm add -D bull-board`
   - Access queue metrics and job status

---

## 📝 API Documentation

### POST /feeds/:id/sync

Manually trigger feed synchronization.

**Request:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "jobId": "fetch-{feedId}-{timestamp}",
  "message": "Manual sync started"
}
```

**Errors:**
- 400: Feed has no channel or sources
- 404: Feed not found

---

### POST /feeds/:id/pause

Pause recurring feed aggregation.

**Request:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "id": "feed-id",
  "status": "paused",
  ...
}
```

**Errors:**
- 400: Only active feeds can be paused
- 404: Feed not found

---

### POST /feeds/:id/resume

Resume paused feed aggregation.

**Request:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "id": "feed-id",
  "status": "active",
  ...
}
```

**Errors:**
- 400: Only paused feeds can be resumed / Feed has no channel
- 404: Feed not found

---

### GET /feeds/:id/jobs

Get recent aggregation jobs for a feed.

**Request:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "jobs": [
    {
      "id": "job-id",
      "feed_id": "feed-id",
      "status": "completed",
      "messages_fetched": 15,
      "messages_posted": 15,
      "error_message": null,
      "started_at": "2026-02-14T12:00:00Z",
      "completed_at": "2026-02-14T12:01:30Z",
      "created_at": "2026-02-14T12:00:00Z"
    }
  ],
  "total": 1
}
```

---

## 🔍 Monitoring & Debugging

### Key Metrics to Track

- Active feeds count
- Messages fetched per hour
- Messages posted per hour
- Failed jobs count
- Average job duration
- Queue depth

### Debugging Commands

**Check queue status:**
```bash
# Redis CLI
redis-cli
> KEYS bull:fetch-queue:*
> LLEN bull:fetch-queue:wait
```

**View logs:**
```bash
# API logs
tail -f apps/api/dist/main.log | grep -E "(FetchProcessor|PostProcessor|Scheduler)"
```

**Database queries:**
```sql
-- Recent jobs
SELECT * FROM aggregation_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Failed jobs
SELECT * FROM aggregation_jobs
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Job statistics
SELECT
  feed_id,
  COUNT(*) as total_jobs,
  SUM(messages_fetched) as total_fetched,
  SUM(messages_posted) as total_posted
FROM aggregation_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY feed_id;
```

---

## 🐛 Known Issues & Limitations

1. **Rate Limiting**
   - Bot API has limits (30 messages/second to same chat)
   - Current delay: 1s per message (conservative)
   - May need adjustment based on testing

2. **Message Order**
   - Messages forwarded in chronological order
   - No guarantee of atomic batch forwarding

3. **Checkpoint Recovery**
   - If post job partially fails, some messages may be re-forwarded
   - Consider implementing idempotency check

4. **Large Message Batches**
   - Fetching 100 messages at once may timeout
   - Consider pagination if needed

---

## ✅ Phase 5 Complete!

**Next Steps:**
- Implement frontend (Phase 5 frontend tasks)
- Add Phase 6: Error handling, monitoring, and polish
- Performance testing with real channels
- Add health check endpoints
