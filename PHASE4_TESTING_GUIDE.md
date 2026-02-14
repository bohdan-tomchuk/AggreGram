# Phase 4 Testing Guide: BullMQ & Telegram Channel Creation

## Prerequisites

1. **Docker containers running:**
   ```bash
   docker ps | grep aggregram
   # Should show: aggregram-postgres and aggregram-redis
   ```

2. **Backend running:**
   ```bash
   cd apps/api
   pnpm dev
   # Should start on port 3001
   ```

3. **Frontend running:**
   ```bash
   cd apps/web
   pnpm dev
   # Should start on port 3000
   ```

4. **User account setup:**
   - Registered user account
   - Telegram connection completed (Phase 2)
   - Bot created via BotFather (Phase 2)

---

## Test 1: Queue Service Initialization

**Objective:** Verify BullMQ connects to Redis successfully.

1. Start the backend server
2. Check logs for:
   ```
   [QueueService] Connecting to Redis at localhost:6379
   [QueueService] Queue service initialized
   [ChannelProcessor] Channel processor initialized
   ```

**Expected:** No connection errors, workers start successfully.

---

## Test 2: Create Feed with Sources (Phase 3 functionality)

**Objective:** Prepare a feed for channel creation.

1. Navigate to dashboard: `http://localhost:3000`
2. Click "Create Feed"
3. Fill in feed details:
   - Name: "Tech News Feed"
   - Description: "Latest tech updates"
   - Polling Interval: 5 minutes
4. Add sources via SourceManager:
   - Search for public channels (e.g., "tech", "news")
   - Add 2-3 source channels to the feed
5. Navigate to feed detail page

**Expected:**
- Feed created with status "draft"
- Sources displayed in SourceManager
- Feed sourceCount shows correct number

---

## Test 3: Channel Creation - Happy Path

**Objective:** Test successful Telegram channel creation.

### Backend verification before test:

1. Check user has active Telegram session:
   ```bash
   # Check TDLib session directory exists
   ls apps/api/.tdlib/{userId}
   ```

2. Verify user has bot in database:
   ```sql
   SELECT * FROM user_bots WHERE user_id = '{userId}';
   ```

### Perform test:

1. On feed detail page, verify:
   - "Create Channel" button is enabled
   - Feed has at least 1 source
   - Feed status is "draft"

2. Click "Create Channel" button

3. Observe:
   - Button shows loading state
   - Toast notification: "Channel creation started"
   - Polling indicator appears: "Creating channel... This may take up to 30 seconds"
   - Poll count increments every 2 seconds

4. After 10-30 seconds:
   - Polling stops automatically
   - Feed status changes to "active"
   - Channel section displays:
     - Channel title
     - Channel ID
     - "Open in Telegram" button with invite link

5. Click "Open in Telegram" button:
   - Link opens Telegram app/web
   - Shows the created channel
   - Channel has the feed name as title
   - Bot is admin of the channel

### Backend logs to verify:

```
[QueueService] Enqueued channel creation job {jobId} for feed {feedId}
[ChannelProcessor] Processing channel creation for feed {feedId}
[TdlibService] Created channel "{title}" with ID {channelId} for user {userId}
[TdlibService] Added bot {botUserId} as admin to channel {channelId}
[ChannelProcessor] Channel creation completed for feed {feedId}
```

### Database verification:

```sql
-- Check feed status updated
SELECT id, name, status FROM feeds WHERE id = '{feedId}';
-- Expected: status = 'active'

-- Check feed_channels table
SELECT * FROM feed_channels WHERE feed_id = '{feedId}';
-- Expected: One row with telegram_channel_id, invite_link, and title
```

**Expected:**
- ✅ Job enqueued successfully
- ✅ Channel created in Telegram
- ✅ Bot added as admin with post permissions
- ✅ Invite link generated
- ✅ Feed status = 'active'
- ✅ Frontend polls and updates automatically

---

## Test 4: Error Handling - No Sources

**Objective:** Verify validation when feed has no sources.

1. Create a new feed without adding any sources
2. Navigate to feed detail page
3. Verify:
   - "Create Channel" button is disabled
   - Message: "Add at least one source channel first"

**Expected:**
- ✅ Button disabled when sourceCount = 0

---

## Test 5: Error Handling - Expired Telegram Session

**Objective:** Test graceful handling of expired sessions.

### Setup:

1. Manually destroy user's TDLib client:
   ```typescript
   // In backend console or via API endpoint
   await tdlibService.destroyClient(userId);
   ```

### Test:

1. Try to create channel for a feed
2. Observe error response:
   ```json
   {
     "message": "Telegram session expired. Please reconnect your account.",
     "statusCode": 400
   }
   ```

3. Frontend shows toast error with message

**Expected:**
- ✅ Clear error message
- ✅ No job enqueued
- ✅ Feed status remains "draft"

---

## Test 6: Error Handling - Channel Already Exists

**Objective:** Prevent duplicate channel creation.

1. Successfully create a channel for a feed (Test 3)
2. Manually set feed status back to 'draft':
   ```sql
   UPDATE feeds SET status = 'draft' WHERE id = '{feedId}';
   ```
3. Try to create channel again
4. Observe error:
   ```json
   {
     "message": "Channel already exists for this feed",
     "statusCode": 400
   }
   ```

**Expected:**
- ✅ Duplicate creation blocked
- ✅ Error message displayed

---

## Test 7: Job Retry on Transient Failure

**Objective:** Verify BullMQ retry mechanism.

### Simulate failure:

1. Temporarily break TDLib (e.g., stop Redis, or modify TdlibService to throw error)
2. Trigger channel creation
3. Observe job failures in logs
4. Fix the issue (restart Redis)
5. Job should retry automatically (up to 3 attempts with exponential backoff)

**Expected:**
- ✅ Job retries on failure
- ✅ Backoff delay increases: 5s, 10s, 20s
- ✅ After 3 failures, feed status = 'error'

---

## Test 8: Concurrent Channel Creation

**Objective:** Test queue concurrency limit.

1. Create 3 feeds with sources
2. Trigger channel creation for all 3 simultaneously (via API or UI)
3. Observe backend logs:
   - Only 1 job processes at a time (concurrency: 1 for channel-queue)
   - Other jobs wait in queue
4. All 3 channels eventually created successfully

**Expected:**
- ✅ Jobs processed sequentially
- ✅ No race conditions
- ✅ All channels created successfully

---

## Test 9: Polling Timeout

**Objective:** Test frontend polling stops after timeout.

1. **Simulate slow channel creation:**
   - Add a delay in ChannelProcessor (e.g., `await new Promise(r => setTimeout(r, 70000))`)

2. Trigger channel creation
3. Observe polling:
   - Polls every 2 seconds
   - Poll count increments: 1, 2, 3, ..., 30
   - After 30 polls (60 seconds), polling stops
   - Message changes to indicate timeout

**Expected:**
- ✅ Polling stops after 60 seconds
- ✅ No infinite polling loop
- ✅ User can manually refresh page to check status

---

## Test 10: Full End-to-End Flow

**Objective:** Complete user journey from registration to active feed channel.

1. **Register new account**
   - Email: test@example.com
   - Password: TestPass123!

2. **Connect Telegram**
   - Complete QR auth flow
   - Bot created automatically

3. **Create feed**
   - Name: "My News Feed"
   - Add 2 source channels

4. **Create channel**
   - Click "Create Channel"
   - Wait for creation (10-30s)

5. **Verify in Telegram**
   - Open invite link
   - Join channel
   - Verify bot is admin
   - Channel title matches feed name

6. **Verify in AggreGram**
   - Feed status = 'active'
   - Channel section shows invite link
   - Source count correct

**Expected:**
- ✅ Complete flow works end-to-end
- ✅ No errors at any step
- ✅ Channel accessible in Telegram
- ✅ Ready for Phase 5 (message aggregation)

---

## Troubleshooting

### Issue: "Queue service initialization failed"
**Cause:** Redis not running or wrong connection config.
**Fix:**
```bash
docker ps | grep redis
# If not running:
docker-compose up -d aggregram-redis
```

### Issue: "Failed to create Telegram channel"
**Cause:** TDLib session issues or API errors.
**Fix:**
1. Check TDLib logs for specific error
2. Verify user is authorized: `await tdlibService.isAuthorized(userId)`
3. Try reconnecting Telegram session

### Issue: Polling never completes
**Cause:** Job stuck or failed silently.
**Fix:**
1. Check BullMQ queue in Redis:
   ```bash
   docker exec aggregram-redis redis-cli
   > KEYS bull:channel-queue:*
   > HGETALL bull:channel-queue:job:{jobId}
   ```
2. Check job status: waiting, active, completed, failed
3. Review processor logs for errors

### Issue: "Bot not found"
**Cause:** User bot not created during Telegram connection.
**Fix:**
1. Check user_bots table:
   ```sql
   SELECT * FROM user_bots WHERE user_id = '{userId}';
   ```
2. If missing, re-run Telegram connection wizard

---

## Success Criteria

All tests passing indicates Phase 4 is complete:

- ✅ Queue service initializes without errors
- ✅ Jobs enqueued successfully
- ✅ Channel created in Telegram via TDLib
- ✅ Bot added as admin with correct permissions
- ✅ Invite link generated and saved
- ✅ Feed status updated to 'active'
- ✅ Frontend polling works correctly
- ✅ Error handling graceful
- ✅ Channel accessible in Telegram app
- ✅ Ready for Phase 5 implementation

---

## Next Steps

Once Phase 4 tests pass:

1. Proceed to **Phase 5**: Message Fetching & Forwarding
   - Implement fetch and post queues
   - Add message aggregation processors
   - Set up recurring job scheduler
   - Test end-to-end message flow

2. Optional improvements before Phase 5:
   - Add channel creation progress percentage
   - Implement webhook for real-time status updates
   - Add retry button for failed channel creation
   - Improve error messages with recovery steps
