# Phase 5: Message Fetching & Forwarding - Testing Guide

## Prerequisites

Before testing Phase 5, ensure the following are complete:

- ✅ Phase 1: User authentication working
- ✅ Phase 2: Feed CRUD endpoints working
- ✅ Phase 3: Channel discovery working
- ✅ Phase 4: Feed channel creation working
- ✅ Database migration ran successfully
- ✅ Redis running (`docker ps | grep aggregram-redis`)
- ✅ API server running (`pnpm dev` in apps/api)

---

## Test Scenario 1: Manual Feed Sync

### Objective
Verify that manually triggering a feed sync fetches and posts messages correctly.

### Steps

1. **Create a test feed** (if not already exists)
   ```bash
   curl -X POST http://localhost:3001/feeds \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Feed",
       "description": "Testing message aggregation",
       "pollingIntervalSec": 300
     }'
   ```

2. **Add source channels** (with active public channels)
   ```bash
   # Example: Add a tech news channel
   curl -X POST http://localhost:3001/feeds/{feedId}/sources \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{
       "channelUsername": "durov"
     }'
   ```

3. **Create feed channel**
   ```bash
   curl -X POST http://localhost:3001/feeds/{feedId}/channel \
     -H "Authorization: Bearer {token}"
   ```

   **Expected:**
   - Job enqueued
   - Channel created in Telegram
   - Feed status changed to `active`
   - Recurring sync scheduled

4. **Wait for channel creation** (~30 seconds)
   ```bash
   # Check feed status
   curl http://localhost:3001/feeds/{feedId} \
     -H "Authorization: Bearer {token}"
   ```

   **Expected Response:**
   ```json
   {
     "id": "feed-id",
     "status": "active",
     "feedChannel": {
       "inviteLink": "https://t.me/+...",
       "telegramChannelId": "...",
       "title": "Test Feed"
     }
   }
   ```

5. **Trigger manual sync**
   ```bash
   curl -X POST http://localhost:3001/feeds/{feedId}/sync \
     -H "Authorization: Bearer {token}"
   ```

   **Expected Response:**
   ```json
   {
     "jobId": "fetch-{feedId}-{timestamp}",
     "message": "Manual sync started"
   }
   ```

6. **Monitor API logs** (in separate terminal)
   ```bash
   # Watch for fetch and post processing
   tail -f apps/api/logs/*.log | grep -E "(FetchProcessor|PostProcessor)"
   ```

   **Expected Log Entries:**
   ```
   [FetchProcessor] Processing fetch job {jobId} for feed {feedId}
   [FetchProcessor] Fetching messages from channel {channelId}
   [FetchProcessor] Found {N} new messages from channel {channelId}
   [FetchProcessor] Enqueuing post job for {N} messages
   [PostProcessor] Processing post job {jobId} for feed {feedId} with {N} messages
   [PostProcessor] Forwarded message {msgId} from source {channelId} to feed channel {feedChannelId}
   [PostProcessor] Post job {jobId} completed: {N}/{N} messages posted
   ```

7. **Check Telegram channel**
   - Open the feed channel using the invite link
   - Verify forwarded messages appear
   - Verify attribution shows source channel

8. **Check aggregation jobs**
   ```bash
   curl http://localhost:3001/feeds/{feedId}/jobs \
     -H "Authorization: Bearer {token}"
   ```

   **Expected Response:**
   ```json
   {
     "jobs": [
       {
         "id": "job-id",
         "feed_id": "feed-id",
         "status": "completed",
         "messages_fetched": 10,
         "messages_posted": 10,
         "error_message": null,
         "started_at": "2026-02-14T15:30:00Z",
         "completed_at": "2026-02-14T15:30:45Z"
       }
     ],
     "total": 1
   }
   ```

### ✅ Success Criteria

- [x] Manual sync endpoint returns job ID
- [x] Fetch job processes successfully
- [x] Post job processes successfully
- [x] Messages appear in Telegram channel
- [x] Aggregation job record created
- [x] Job status is `completed`
- [x] `messages_fetched` and `messages_posted` counts match

---

## Test Scenario 2: Automatic Recurring Sync

### Objective
Verify that feeds automatically poll for new messages at the configured interval.

### Steps

1. **Ensure feed is active** (from Scenario 1)
   ```bash
   curl http://localhost:3001/feeds/{feedId} \
     -H "Authorization: Bearer {token}"
   # status should be "active"
   ```

2. **Post new messages to source channel**
   - In Telegram, post 2-3 new messages to one of the source channels
   - Or use a channel with frequent updates

3. **Wait for polling interval** (default: 5 minutes)
   - Monitor logs for automatic fetch job

4. **Check logs for scheduled job**
   ```bash
   tail -f apps/api/logs/*.log | grep "recurring-fetch"
   ```

   **Expected:**
   ```
   [SchedulerService] Scheduled feed {feedId} for polling every 300s
   [FetchProcessor] Processing fetch job recurring-fetch-{feedId} for feed {feedId}
   ```

5. **Verify new messages forwarded**
   - Check Telegram channel for new forwarded messages

6. **Check updated aggregation jobs**
   ```bash
   curl http://localhost:3001/feeds/{feedId}/jobs \
     -H "Authorization: Bearer {token}"
   ```

   **Expected:**
   - Multiple job records (initial + recurring)
   - Latest job shows new messages

### ✅ Success Criteria

- [x] Recurring job executes automatically
- [x] New messages detected and forwarded
- [x] Multiple aggregation jobs visible
- [x] No errors in logs

---

## Test Scenario 3: Pause and Resume Feed

### Objective
Verify that pausing a feed stops recurring sync, and resuming restarts it.

### Steps

1. **Pause the feed**
   ```bash
   curl -X POST http://localhost:3001/feeds/{feedId}/pause \
     -H "Authorization: Bearer {token}"
   ```

   **Expected Response:**
   ```json
   {
     "id": "feed-id",
     "status": "paused",
     ...
   }
   ```

2. **Verify no new sync jobs**
   - Wait for 2x polling interval (e.g., 10 minutes if interval is 5 min)
   - Check logs - should NOT see new fetch jobs

3. **Post messages to source channel**
   - Messages should NOT be forwarded while paused

4. **Resume the feed**
   ```bash
   curl -X POST http://localhost:3001/feeds/{feedId}/resume \
     -H "Authorization: Bearer {token}"
   ```

   **Expected Response:**
   ```json
   {
     "id": "feed-id",
     "status": "active",
     ...
   }
   ```

5. **Verify sync resumes**
   - Wait for polling interval
   - Check logs for new fetch job
   - Verify paused messages are now forwarded

### ✅ Success Criteria

- [x] Pause endpoint works
- [x] Feed status changes to `paused`
- [x] No sync jobs while paused
- [x] Resume endpoint works
- [x] Feed status changes to `active`
- [x] Sync jobs resume
- [x] Missed messages forwarded

---

## Test Scenario 4: Checkpoint Persistence

### Objective
Verify that the checkpoint (lastMessageId) prevents duplicate message forwarding.

### Steps

1. **Trigger manual sync** (with existing messages)
   ```bash
   curl -X POST http://localhost:3001/feeds/{feedId}/sync \
     -H "Authorization: Bearer {token}"
   ```

2. **Note forwarded messages** (e.g., 10 messages)

3. **Check database checkpoint**
   ```sql
   SELECT * FROM feed_sources
   WHERE feed_id = '{feedId}';
   ```

   **Expected:**
   - `last_message_id` updated for each source

4. **Trigger another manual sync immediately**
   ```bash
   curl -X POST http://localhost:3001/feeds/{feedId}/sync \
     -H "Authorization: Bearer {token}"
   ```

5. **Check aggregation job**
   ```bash
   curl http://localhost:3001/feeds/{feedId}/jobs \
     -H "Authorization: Bearer {token}"
   ```

   **Expected:**
   - Latest job shows `messages_fetched: 0` (no new messages)
   - Status: `completed`

6. **Verify no duplicate forwards**
   - Check Telegram channel
   - Should NOT see duplicate messages

### ✅ Success Criteria

- [x] Checkpoint (lastMessageId) persists after sync
- [x] Second sync detects no new messages
- [x] No duplicate messages in Telegram channel

---

## Test Scenario 5: Multiple Source Channels

### Objective
Verify that messages from multiple sources are aggregated correctly.

### Steps

1. **Add multiple source channels**
   ```bash
   # Add source 1
   curl -X POST http://localhost:3001/feeds/{feedId}/sources \
     -H "Authorization: Bearer {token}" \
     -d '{"channelUsername": "channel1"}'

   # Add source 2
   curl -X POST http://localhost:3001/feeds/{feedId}/sources \
     -H "Authorization: Bearer {token}" \
     -d '{"channelUsername": "channel2"}'

   # Add source 3
   curl -X POST http://localhost:3001/feeds/{feedId}/sources \
     -H "Authorization: Bearer {token}" \
     -d '{"channelUsername": "channel3"}'
   ```

2. **Trigger sync**
   ```bash
   curl -X POST http://localhost:3001/feeds/{feedId}/sync \
     -H "Authorization: Bearer {token}"
   ```

3. **Check logs**
   ```bash
   tail -f apps/api/logs/*.log | grep "Fetching messages from channel"
   ```

   **Expected:**
   - Log entries for each source channel

4. **Verify Telegram channel**
   - Should contain messages from all 3 sources
   - Messages should show attribution (forwarded from)

5. **Check aggregation job**
   ```bash
   curl http://localhost:3001/feeds/{feedId}/jobs \
     -H "Authorization: Bearer {token}"
   ```

   **Expected:**
   - `messages_fetched` = total from all sources

### ✅ Success Criteria

- [x] Messages fetched from all sources
- [x] All messages forwarded correctly
- [x] Attribution preserved
- [x] Checkpoint updated for each source

---

## Test Scenario 6: Error Handling

### Objective
Verify graceful error handling when issues occur.

### Subtests

### 6A: Bot Revoked

1. **Remove bot from feed channel**
   - In Telegram, remove the bot as admin

2. **Trigger sync**
   ```bash
   curl -X POST http://localhost:3001/feeds/{feedId}/sync \
     -H "Authorization: Bearer {token}"
   ```

3. **Check job status**
   ```bash
   curl http://localhost:3001/feeds/{feedId}/jobs \
     -H "Authorization: Bearer {token}"
   ```

   **Expected:**
   - Status: `failed`
   - `error_message`: "Bot not found" or similar

### 6B: Source Channel Unavailable

1. **Add a non-existent channel**
   ```bash
   curl -X POST http://localhost:3001/feeds/{feedId}/sources \
     -H "Authorization: Bearer {token}" \
     -d '{"channelUsername": "nonexistentchannel12345"}'
   ```

   **Expected:**
   - 404 error: Channel not found

### 6C: Rate Limiting

1. **Trigger multiple rapid syncs**
   ```bash
   for i in {1..5}; do
     curl -X POST http://localhost:3001/feeds/{feedId}/sync \
       -H "Authorization: Bearer {token}"
   done
   ```

2. **Check job queue**
   ```bash
   redis-cli LLEN bull:fetch-queue:wait
   ```

   **Expected:**
   - Jobs queued but processed sequentially
   - No rate limit errors from Telegram

### ✅ Success Criteria

- [x] Errors logged clearly
- [x] Jobs marked as `failed` with error messages
- [x] System continues operating
- [x] Rate limits respected

---

## Test Scenario 7: Feed Deletion Cleanup

### Objective
Verify that deleting a feed removes scheduled jobs.

### Steps

1. **Create and activate a feed** (follow Scenario 1)

2. **Verify recurring job scheduled**
   ```bash
   # Check Redis for repeatable job
   redis-cli KEYS bull:fetch-queue:repeat:*
   ```

3. **Delete the feed**
   ```bash
   curl -X DELETE http://localhost:3001/feeds/{feedId} \
     -H "Authorization: Bearer {token}"
   ```

4. **Verify job unscheduled**
   ```bash
   redis-cli KEYS bull:fetch-queue:repeat:*
   # Should not include this feed's job
   ```

5. **Verify no more syncs**
   - Monitor logs
   - Should NOT see fetch jobs for deleted feed

### ✅ Success Criteria

- [x] Feed deleted successfully
- [x] Recurring job removed from queue
- [x] No more sync jobs for deleted feed

---

## Test Scenario 8: Service Restart Resilience

### Objective
Verify that recurring jobs are rescheduled after API restart.

### Steps

1. **Create and activate a feed** (follow Scenario 1)

2. **Restart API server**
   ```bash
   # Ctrl+C to stop, then:
   pnpm dev
   ```

3. **Check logs on startup**
   ```bash
   tail -f apps/api/logs/*.log | grep SchedulerService
   ```

   **Expected:**
   ```
   [SchedulerService] Initializing feed scheduler...
   [SchedulerService] Found {N} active feeds to schedule
   [SchedulerService] Scheduled feed {feedId} for polling every {interval}s
   [SchedulerService] Feed scheduler initialized
   ```

4. **Verify syncs continue**
   - Wait for polling interval
   - Check for new fetch jobs

### ✅ Success Criteria

- [x] SchedulerService initializes on startup
- [x] All active feeds rescheduled
- [x] Recurring syncs continue

---

## Performance Testing

### Load Test: Multiple Feeds

1. **Create 10 feeds** with different polling intervals
2. **Add 5 source channels** per feed
3. **Activate all feeds**
4. **Monitor system resources**
   ```bash
   # CPU and memory
   top

   # Queue depth
   redis-cli LLEN bull:fetch-queue:wait
   redis-cli LLEN bull:post-queue:wait
   ```

5. **Check for bottlenecks**
   - Should handle 10+ concurrent feeds
   - No memory leaks
   - Queue should drain efficiently

### ✅ Success Criteria

- [x] All feeds process successfully
- [x] No job failures due to resource constraints
- [x] Acceptable latency (< 5 min total per sync)

---

## Database Validation

### Verify Data Integrity

```sql
-- Check feed sources have checkpoints
SELECT
  fs.id,
  fs.feed_id,
  fs.source_channel_id,
  fs.last_message_id,
  sc.username
FROM feed_sources fs
JOIN source_channels sc ON fs.source_channel_id = sc.id
WHERE fs.feed_id = '{feedId}';

-- Verify aggregation jobs
SELECT
  id,
  feed_id,
  status,
  messages_fetched,
  messages_posted,
  error_message,
  started_at,
  completed_at
FROM aggregation_jobs
WHERE feed_id = '{feedId}'
ORDER BY created_at DESC
LIMIT 10;

-- Check for orphaned jobs (feed deleted but jobs remain)
SELECT aj.*
FROM aggregation_jobs aj
LEFT JOIN feeds f ON aj.feed_id = f.id
WHERE f.id IS NULL;
```

### ✅ Success Criteria

- [x] All feed sources have valid checkpoints
- [x] Aggregation jobs reference valid feeds
- [x] No orphaned records

---

## Troubleshooting Guide

### Issue: Fetch job runs but no messages found

**Possible Causes:**
- Source channels have no new messages
- Checkpoint (lastMessageId) already at latest

**Debug:**
```bash
# Check source channel last message
curl http://localhost:3001/channels/{channelUsername} \
  -H "Authorization: Bearer {token}"

# Check feed source checkpoint
psql -U aggregram -d aggregram -c "
  SELECT * FROM feed_sources WHERE feed_id = '{feedId}';
"
```

### Issue: Messages not forwarding

**Possible Causes:**
- Bot removed from channel
- Bot token invalid
- Rate limiting

**Debug:**
```bash
# Check bot status
psql -U aggregram -d aggregram -c "
  SELECT * FROM user_bots WHERE user_id = '{userId}';
"

# Check post job errors
psql -U aggregram -d aggregram -c "
  SELECT * FROM aggregation_jobs
  WHERE feed_id = '{feedId}' AND status = 'failed';
"

# Test bot token manually
curl https://api.telegram.org/bot{token}/getMe
```

### Issue: Recurring jobs not running

**Possible Causes:**
- Feed status not `active`
- Scheduler not initialized
- Redis connection lost

**Debug:**
```bash
# Check feed status
curl http://localhost:3001/feeds/{feedId} \
  -H "Authorization: Bearer {token}"

# Check Redis connection
redis-cli ping

# Check repeatable jobs
redis-cli KEYS bull:fetch-queue:repeat:*

# Restart API to reinitialize scheduler
```

### Issue: Duplicate messages forwarded

**Possible Causes:**
- Checkpoint not updating
- Post job failing partially

**Debug:**
```sql
-- Check if checkpoint updated after last job
SELECT
  fs.last_message_id,
  aj.messages_posted,
  aj.completed_at
FROM feed_sources fs
JOIN aggregation_jobs aj ON fs.feed_id = aj.feed_id
WHERE fs.feed_id = '{feedId}'
ORDER BY aj.created_at DESC
LIMIT 1;
```

---

## Regression Testing Checklist

Before marking Phase 5 as complete, verify:

- [x] All Scenario 1-8 tests pass
- [x] No API errors in logs
- [x] No database constraint violations
- [x] Performance acceptable (load test passes)
- [x] Data integrity checks pass
- [x] Previous phases (1-4) still work
- [x] Frontend can still create feeds
- [x] Channel creation still works

---

## Next Steps

After Phase 5 backend testing is complete:

1. **Implement Frontend** (Phase 5 frontend tasks)
   - Add sync/pause/resume UI controls
   - Display job history
   - Show real-time sync status

2. **Add Monitoring** (Phase 6)
   - Health check endpoints
   - Metrics dashboard
   - Alert system for failed jobs

3. **Performance Optimization**
   - Adjust queue concurrency
   - Optimize checkpoint queries
   - Add caching where appropriate

---

## Support

For issues or questions:
- Check API logs: `apps/api/logs/*.log`
- Check database: `psql -U aggregram -d aggregram`
- Check Redis: `redis-cli`
- Review Phase 5 implementation doc: `PHASE5_IMPLEMENTATION.md`
