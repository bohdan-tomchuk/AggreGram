# Feed Creation & Post Forwarding Implementation Plan

## Context

AggreGram's core value proposition is aggregating content from public Telegram channels into personalized feeds. While the authentication and Telegram connection flows are complete, the actual feed functionality is currently missing.

**Current State:**
- ✅ Frontend: Complete UI scaffolding exists (types, API layer, Pinia store, components like FeedCard/FeedGrid, placeholder pages)
- ✅ Backend: Auth module and Telegram connection wizard are fully functional
- ❌ Backend: No feed module, entities, or endpoints exist
- ❌ Database: No feed tables (feeds, feed_channels, feed_sources, source_channels)
- ❌ Job Queue: BullMQ not set up for message aggregation
- ❌ Integration: Frontend uses mock data, not connected to real API

**Goal:**
Implement end-to-end feed creation and post forwarding: users can create feeds, add source channels, and have messages automatically aggregated into their Telegram feed channel.

---

## Implementation Phases

### Phase 1: Database Schema & Feed Entities

**Goal:** Establish the data foundation for feeds.

**Backend Tasks:**

1. **Create database migration** (`apps/api/src/database/migrations/{timestamp}-CreateFeedTables.ts`):
   - `source_channels` table:
     - id (uuid), telegram_channel_id (bigint), username, title, description, subscriber_count, avatar_url, last_metadata_sync, created_at, updated_at
     - Unique index on telegram_channel_id

   - `feeds` table:
     - id (uuid), user_id (uuid FK → users), name, description, status (enum: draft/active/paused/error), polling_interval_sec (default: 300), created_at, updated_at
     - Index on user_id + status

   - `feed_sources` junction table:
     - id (uuid), feed_id (uuid FK → feeds CASCADE), source_channel_id (uuid FK → source_channels), last_message_id (bigint nullable), added_at
     - Unique constraint: (feed_id, source_channel_id)
     - Index on feed_id

   - `feed_channels` table:
     - id (uuid), feed_id (uuid FK → feeds UNIQUE CASCADE), telegram_channel_id (bigint), invite_link, title, created_at, updated_at

2. **Create TypeORM entities:**
   - `apps/api/src/modules/feeds/entities/source-channel.entity.ts`
   - `apps/api/src/modules/feeds/entities/feed.entity.ts` (with @ManyToOne to User, @OneToMany to FeedSource, @OneToOne to FeedChannel)
   - `apps/api/src/modules/feeds/entities/feed-source.entity.ts` (junction with @ManyToOne relations)
   - `apps/api/src/modules/feeds/entities/feed-channel.entity.ts`

3. **Update database configuration:**
   - Add entities to `apps/api/src/database/database.module.ts` entities array
   - Add entities to `apps/api/src/database/data-source.ts` entities array

**Commands:**
```bash
cd apps/api
pnpm migration:generate CreateFeedTables
pnpm migration:run
```

**Verification:**
- ✓ Migration runs without errors
- ✓ Tables created with correct columns, types, and foreign keys
- ✓ Cascade deletes work (deleting feed removes sources and channel)
- ✓ Entities import without circular dependencies

---

### Phase 2: Feed CRUD API

**Goal:** Enable users to create, read, update, and delete feeds (draft status, no Telegram channel yet).

**Backend Tasks:**

1. **Create Feeds module structure:**
   - `apps/api/src/modules/feeds/feeds.module.ts`:
     - Import TypeOrmModule.forFeature([Feed, FeedChannel, FeedSource, SourceChannel])
     - Providers: FeedsService, FeedsController
     - Exports: FeedsService

   - `apps/api/src/modules/feeds/feeds.service.ts`:
     - Constructor: inject repositories, UsersService
     - Methods:
       - `create(userId, data)` → Creates feed with status='draft'
       - `findAll(userId)` → Lists feeds with sourceCount via QueryBuilder
       - `findOne(userId, feedId)` → Get feed with relations
       - `update(userId, feedId, data)` → Update name/description/pollingInterval
       - `delete(userId, feedId)` → Soft delete (cascade via DB)

   - `apps/api/src/modules/feeds/feeds.controller.ts`:
     - `@UseGuards(JwtAuthGuard)` on class level
     - `GET /feeds` → List user's feeds
     - `POST /feeds` → Create feed
     - `GET /feeds/:id` → Get feed details
     - `PATCH /feeds/:id` → Update feed
     - `DELETE /feeds/:id` → Delete feed

2. **Create DTOs:**
   - `apps/api/src/modules/feeds/dto/create-feed.dto.ts`:
     - name (string, @IsString, @MinLength(1), @MaxLength(100))
     - description (string optional, @IsOptional, @MaxLength(500))
     - pollingIntervalSec (number optional, @IsOptional, @IsInt, @Min(60), @Max(3600), default: 300)

   - `apps/api/src/modules/feeds/dto/update-feed.dto.ts`:
     - Extends PartialType(CreateFeedDto)

3. **Update app module:**
   - Add FeedsModule to `apps/api/src/app.module.ts` imports

**Frontend Tasks:**

1. **Remove mock data dependency:**
   - Update `apps/web/src/pages/index.vue`: Remove `useMock=true` from fetchFeeds call
   - Update `apps/web/src/entities/feed/model/feedStore.ts`: Remove useMock parameter default

2. **Implement feed creation page** (`apps/web/src/pages/feeds/new.vue`):
   - Form with name, description (textarea), pollingIntervalSec (select: 1min/5min/15min/30min/1hr)
   - Use feedStore.createFeed()
   - Navigate to `/feeds/${newFeed.id}` on success
   - Add middleware: auth, telegram-connected

3. **Implement feed detail page** (`apps/web/src/pages/feeds/[id]/index.vue`):
   - Fetch feed via feedStore
   - Display feed metadata (name, description, status badge, polling interval)
   - Show "No channel created yet" for draft feeds
   - Add middleware: auth, telegram-connected

**Verification:**
- ✓ POST /feeds creates feed in database with draft status
- ✓ GET /feeds returns user's feeds (empty array initially)
- ✓ PATCH /feeds/:id updates feed name
- ✓ DELETE /feeds/:id removes feed from database
- ✓ Frontend form creates feed and navigates to detail page
- ✓ Feed list displays real data from API

---

### Phase 3: Channel Discovery & Source Management

**Goal:** Enable users to search Telegram channels and add them as feed sources.

**Backend Tasks:**

1. **Create Channels module:**
   - `apps/api/src/modules/channels/channels.module.ts`:
     - Import TelegramModule, TypeOrmModule.forFeature([SourceChannel])
     - Providers: ChannelsService, ChannelsController

   - `apps/api/src/modules/channels/channels.service.ts`:
     - Constructor: inject TdlibService, SourceChannel repository
     - Methods:
       - `searchPublicChannels(userId, query)` → Use TdlibService to search, map to SourceChannel format, upsert to DB
       - `getChannelByUsername(userId, username)` → Get channel info via TDLib, upsert to DB
       - `getUserSubscriptions(userId)` → Get user's joined channels (via TDLib getChats)

   - `apps/api/src/modules/channels/channels.controller.ts`:
     - `GET /channels/search?q={query}` → Search channels
     - `GET /channels/:username` → Get channel info
     - `GET /channels/subscriptions` → User's subscriptions

2. **Extend TdlibService** (`apps/api/src/modules/telegram/services/tdlib.service.ts`):
   - Add method: `searchPublicChats(userId, query)` → Uses TDLib client.invoke('searchPublicChats', {query})
   - Add method: `getChat(userId, chatId)` → Gets chat info
   - Add method: `getSupergroupFullInfo(userId, supergroupId)` → Gets subscriber count, etc.

3. **Extend FeedsService:**
   - `addSource(userId, feedId, channelUsername)`:
     - Verify feed belongs to user
     - Get SourceChannel by username (create if not exists)
     - Create FeedSource junction record
     - Return updated feed with sourceCount

   - `removeSource(userId, feedId, sourceId)`:
     - Verify ownership
     - Delete FeedSource record

   - `getSources(userId, feedId)`:
     - Return feed sources with channel details

4. **Add FeedsController endpoints:**
   - `POST /feeds/:id/sources` → Body: {channelUsername} → Calls addSource
   - `GET /feeds/:id/sources` → List feed sources
   - `DELETE /feeds/:id/sources/:sourceId` → Remove source

5. **Update app module:**
   - Add ChannelsModule to imports

**Frontend Tasks:**

1. **Create channel search composable** (`apps/web/src/shared/model/composables/useChannelSearch.ts`):
   - State: query, results, loading, error
   - Function: search(query) → Debounced API call to /channels/search
   - Return reactive refs

2. **Update feed creation page** (`apps/web/src/pages/feeds/new.vue`):
   - Add channel search input (using useChannelSearch)
   - Display search results as selectable cards
   - Multi-select sources (checkbox list)
   - Pass sourceChannelUsernames array to createFeed (modify CreateFeedRequest type)
   - Backend creates feed + adds sources atomically

3. **Create source management UI:**
   - Add "Manage Sources" button to feed detail page
   - Create modal/sheet with:
     - List of current sources (with remove button)
     - Search input to add new sources
     - Use feedStore actions for add/remove

**Verification:**
- ✓ Search "tech" returns public channels like @TechCrunch
- ✓ POST /feeds/:id/sources adds source to feed
- ✓ GET /feeds/:id/sources returns list of sources
- ✓ DELETE /feeds/:id/sources/:id removes source
- ✓ Frontend search displays results with metadata
- ✓ Creating feed with sources saves them to feed_sources table
- ✓ Feed detail page shows source count

---

### Phase 4: BullMQ Setup & Telegram Channel Creation

**Goal:** Set up job queue and implement automated Telegram channel creation for feeds.

**Backend Tasks:**

1. **Install BullMQ:**
   ```bash
   cd apps/api && pnpm add bullmq
   ```

2. **Create Queue module:**
   - `apps/api/src/modules/queue/queue.module.ts`:
     - Global module
     - Providers: QueueService, ChannelProcessor
     - Exports: QueueService

   - `apps/api/src/modules/queue/queue.service.ts`:
     - Constructor: inject ConfigService
     - Initialize queues:
       - `channelQueue` = new Queue('channel-queue', {connection: redisConfig})
       - Future: fetchQueue, postQueue, healthQueue
     - Methods:
       - `enqueueChannelCreation(feedId, userId)` → Adds job to channelQueue

   - `apps/api/src/modules/queue/processors/channel.processor.ts`:
     - `@Processor('channel-queue')` decorator
     - `@Process('create-feed-channel')` handler:
       - Get feed, user, bot from DB
       - Use TdlibService.createChannel(userId, feedName, feedDescription)
       - Use TdlibService.addBotAsAdmin(userId, channelId, botId)
       - Use TdlibService.getInviteLink(userId, channelId)
       - Save to feed_channels table
       - Update feed.status = 'active'
       - Handle errors → set feed.status = 'error'

3. **Extend TdlibService** (add channel operations):
   - `createChannel(userId, title, description)`:
     - Uses client.invoke('createNewSupergroupChat', {title, description, isChannel: true})
     - Returns chatId

   - `addBotAsAdmin(userId, channelId, botUserId)`:
     - Get bot user object
     - Uses client.invoke('setChatMemberStatus', {chatId, userId: botUserId, status: {_: 'chatMemberStatusAdministrator', canPostMessages: true}})

   - `getInviteLink(userId, channelId)`:
     - Uses client.invoke('getChatInviteLink', {chatId})
     - Returns invite link

4. **Extend FeedsService:**
   - `createChannel(userId, feedId)`:
     - Verify feed is draft and has sources
     - Verify user has active Telegram connection and bot
     - Call queueService.enqueueChannelCreation(feedId, userId)
     - Return job acknowledgment

   - Listen for job completion (EventEmitter):
     - On 'channel.created' event → update feed status

5. **Add FeedsController endpoint:**
   - `POST /feeds/:id/channel` → Triggers channel creation

6. **Create Redis config** (`apps/api/src/config/redis.config.ts`):
   - registerAs('redis', () => ({host, port, password}))

7. **Update app module:**
   - Add QueueModule to imports

**Frontend Tasks:**

1. **Extend feedApi** (`apps/web/src/entities/feed/api/feedApi.ts`):
   - Add method: `createChannel(feedId)` → POST /feeds/:id/channel

2. **Extend feedStore:**
   - Add action: `createChannel(feedId)`
   - Add loading state: channelCreationLoading

3. **Update feed detail page:**
   - Show "Create Channel" button for draft feeds (with source count > 0)
   - On click, call feedStore.createChannel(feedId)
   - Show loading spinner during creation
   - Poll feed status every 2s during creation
   - Once status='active', display channel invite link
   - Add "Open in Telegram" button (tg://resolve?domain=...)

**Verification:**
- ✓ Queue connects to Redis without errors
- ✓ POST /feeds/:id/channel enqueues job
- ✓ ChannelProcessor picks up job
- ✓ TDLib creates Telegram channel successfully
- ✓ Bot added as admin with post permissions
- ✓ Invite link generated and saved to feed_channels table
- ✓ Feed status updated to 'active'
- ✓ Frontend displays invite link and "Open" button
- ✓ Clicking invite link opens Telegram to join channel

---

### Phase 5: Message Fetching & Forwarding (Aggregation Engine)

**Goal:** Implement automated polling and message forwarding from source channels to feed channel.

**Backend Tasks:**

1. **Create aggregation jobs entity:**
   - `apps/api/src/modules/feeds/entities/aggregation-job.entity.ts`:
     - id, feed_id (FK), status (pending/running/completed/failed), messages_fetched, messages_posted, error_message, started_at, completed_at, created_at, updated_at

2. **Migration for aggregation_jobs table:**
   ```bash
   pnpm migration:generate CreateAggregationJobsTable
   pnpm migration:run
   ```

3. **Extend QueueService:**
   - Add queues:
     - `fetchQueue` = new Queue('fetch-queue', {connection, limiter: {max: 5, duration: 1000}})
     - `postQueue` = new Queue('post-queue', {connection, limiter: {max: 3, duration: 1000}})

   - Methods:
     - `enqueueFetchJob(feedId)` → Adds 'fetch-feed-sources' job
     - `enqueuePostJob(feedId, messages)` → Adds 'post-to-feed' job

4. **Create FetchProcessor** (`apps/api/src/modules/queue/processors/fetch.processor.ts`):
   - `@Processor('fetch-queue')` decorator
   - `@Process('fetch-feed-sources')` handler:
     - Get feed with sources and channel
     - For each source:
       - Get last_message_id checkpoint from feed_sources
       - Use TdlibService.getChatHistory(userId, sourceChannelId, fromMessageId, limit=100)
       - Filter messages (skip deleted, service messages)
       - Collect message references (sourceChannelId, messageId)
     - If messages found, enqueue post job
     - Update aggregation_job record (messages_fetched count)

5. **Create PostProcessor** (`apps/api/src/modules/queue/processors/post.processor.ts`):
   - `@Processor('post-queue')` decorator
   - `@Process('post-to-feed')` handler:
     - Get feed channel and bot token
     - For each message:
       - Use TdlibService.forwardMessage(botToken, sourceChannelId, messageId, feedChannelId)
       - Update last_message_id checkpoint in feed_sources
     - Update aggregation_job (messages_posted count, status='completed')
     - Handle errors (retry 3x, then mark failed)

6. **Extend TdlibService:**
   - `getChatHistory(userId, chatId, fromMessageId, limit)`:
     - Uses client.invoke('getChatHistory', {chatId, fromMessageId, limit, offset: -99})
     - Returns message array

   - `forwardMessage(botToken, fromChatId, messageId, toChatId)`:
     - Uses Bot API: POST https://api.telegram.org/bot{token}/forwardMessage
     - Body: {chat_id: toChatId, from_chat_id: fromChatId, message_id: messageId}

7. **Create SchedulerService** (`apps/api/src/modules/queue/scheduler.service.ts`):
   - `@Injectable()` class
   - Constructor: inject FeedsService, QueueService
   - Method: `onModuleInit()`:
     - Find all active feeds
     - For each feed, schedule recurring job based on polling_interval_sec
     - Use BullMQ repeatableJobs: `fetchQueue.add('fetch-feed-sources', {feedId}, {repeat: {every: intervalMs}})`

   - Method: `scheduleFeed(feedId, intervalSec)`:
     - Add repeatable job

   - Method: `unscheduleFeed(feedId)`:
     - Remove repeatable job

8. **Extend FeedsService:**
   - `syncFeed(userId, feedId)` → Manually trigger fetch job (no repeat)
   - `pauseFeed(userId, feedId)`:
     - Update status='paused'
     - Call schedulerService.unscheduleFeed(feedId)

   - `resumeFeed(userId, feedId)`:
     - Update status='active'
     - Call schedulerService.scheduleFeed(feedId, feed.pollingIntervalSec)

9. **Add FeedsController endpoints:**
   - `POST /feeds/:id/sync` → Manual sync
   - `POST /feeds/:id/pause` → Pause aggregation
   - `POST /feeds/:id/resume` → Resume aggregation
   - `GET /feeds/:id/jobs` → List recent aggregation jobs

**Frontend Tasks:**

1. **Extend feedApi:**
   - `syncFeed(feedId)` → POST /feeds/:id/sync
   - `pauseFeed(feedId)` → POST /feeds/:id/pause
   - `resumeFeed(feedId)` → POST /feeds/:id/resume
   - `getJobs(feedId)` → GET /feeds/:id/jobs

2. **Extend feedStore:**
   - Add actions: syncFeed, pauseFeed, resumeFeed

3. **Update feed detail page:**
   - Add "Sync Now" button (triggers manual sync)
   - Add Pause/Resume toggle based on feed status
   - Display last sync time (aggregation_jobs.completed_at)
   - Show stats: messages fetched today, messages posted today

4. **Create FeedActivity component** (`apps/web/src/widgets/dashboard/ui/FeedActivity.vue`):
   - Props: feedId
   - Fetches recent jobs via API
   - Displays timeline of sync jobs
   - Shows success/failure indicators
   - Auto-refreshes every 30s for active feeds

**Verification:**
- ✓ Active feed automatically polls every polling_interval_sec
- ✓ FetchProcessor retrieves new messages from sources
- ✓ PostProcessor forwards messages to feed channel via bot
- ✓ Checkpoint (last_message_id) updated after each message
- ✓ Manual sync triggers immediate fetch
- ✓ Pause stops recurring jobs
- ✓ Resume restarts recurring jobs
- ✓ Frontend displays sync status and job history
- ✓ **End-to-end test:** Create feed → add sources → create channel → messages appear in Telegram channel

---

### Phase 6: Error Handling, Monitoring & Polish

**Goal:** Production-ready error handling, health checks, and UX improvements.

**Backend Tasks:**

1. **Enhanced error handling in services:**
   - **FeedsService:**
     - Check session status before operations
     - Throw clear errors: 'Telegram session expired', 'Bot not found', 'Feed has no sources'

   - **TdlibService:**
     - Catch TDLib errors, map to NestJS exceptions
     - 'PHONE_CODE_INVALID' → BadRequestException
     - 'FLOOD_WAIT' → TooManyRequestsException with retry-after header

   - **Job Processors:**
     - Retry failed jobs 3x with exponential backoff
     - Log all errors with context (feedId, userId, messageId)
     - Update aggregation_job with error_message on permanent failure

2. **Health check endpoints** (`apps/api/src/modules/health/health.controller.ts`):
   - `GET /health/feeds` → Returns: {activeFeeds, queueDepth, avgJobDuration}
   - `GET /health/session/:userId` → Returns: {status, lastActivity}

3. **Logging improvements:**
   - Add structured logging to all aggregation operations
   - Log checkpoint updates: `{feedId, sourceId, oldCheckpoint, newCheckpoint}`
   - Log job metrics: `{feedId, messagesFetched, messagesPosted, durationMs}`

4. **Rate limit handling:**
   - Catch FLOOD_WAIT errors from Telegram
   - Exponential backoff: initial 5s, max 5min
   - Store rate limit state in Redis

**Frontend Tasks:**

1. **Error states on all pages:**
   - Feed list: Show banner if any feed has error status
   - Feed detail: Display error message with action button ("Reconnect Telegram", "Fix Issue")
   - Channel creation: Handle bot revoked error

2. **Improve feed creation UX:**
   - Add form validation (name min 3 chars)
   - Show loading state during API calls
   - Success animation on feed creation
   - Guide user to next step: "Now add sources"

3. **Empty states:**
   - No feeds yet → "Create your first feed" CTA
   - Feed has no sources → "Add channels to aggregate from"
   - Feed channel not created → "Create Telegram channel to start"

4. **Status dashboard widget** (`apps/web/src/widgets/dashboard/ui/StatusWidget.vue`):
   - Session health indicator (green/yellow/red)
   - Active feeds count
   - Total messages aggregated (today/all time)
   - Last sync time across all feeds

5. **Notifications system:**
   - Poll /api/notifications endpoint every 60s
   - Display toast for: session expired, feed errors, new messages threshold

**Verification:**
- ✓ Session expiry detected and clear error shown
- ✓ Job failures retry with backoff
- ✓ Health endpoints return accurate metrics
- ✓ Rate limits handled gracefully
- ✓ Frontend shows contextual errors and recovery actions
- ✓ Empty states guide users through setup
- ✓ Status widget reflects real-time system health
- ✓ **Full smoke test:** New user → register → connect Telegram → create feed → add sources → create channel → messages flow → pause/resume → all works smoothly

---

## Critical Files Reference

**Phase 1 - Database Schema:**
- `apps/api/src/database/migrations/{timestamp}-CreateFeedTables.ts`
- `apps/api/src/modules/feeds/entities/feed.entity.ts`
- `apps/api/src/modules/feeds/entities/feed-channel.entity.ts`
- `apps/api/src/modules/feeds/entities/feed-source.entity.ts`
- `apps/api/src/modules/feeds/entities/source-channel.entity.ts`

**Phase 2 - Feed CRUD:**
- `apps/api/src/modules/feeds/feeds.module.ts`
- `apps/api/src/modules/feeds/feeds.service.ts`
- `apps/api/src/modules/feeds/feeds.controller.ts`
- `apps/api/src/modules/feeds/dto/create-feed.dto.ts`
- `apps/web/src/pages/feeds/new.vue`
- `apps/web/src/pages/feeds/[id]/index.vue`

**Phase 3 - Channel Discovery:**
- `apps/api/src/modules/channels/channels.module.ts`
- `apps/api/src/modules/channels/channels.service.ts`
- `apps/api/src/modules/channels/channels.controller.ts`
- `apps/api/src/modules/telegram/services/tdlib.service.ts` (extend)
- `apps/web/src/shared/model/composables/useChannelSearch.ts`

**Phase 4 - Job Queue & Channel Creation:**
- `apps/api/src/modules/queue/queue.module.ts`
- `apps/api/src/modules/queue/queue.service.ts`
- `apps/api/src/modules/queue/processors/channel.processor.ts`
- `apps/api/src/config/redis.config.ts`

**Phase 5 - Message Aggregation:**
- `apps/api/src/modules/queue/processors/fetch.processor.ts`
- `apps/api/src/modules/queue/processors/post.processor.ts`
- `apps/api/src/modules/queue/scheduler.service.ts`
- `apps/api/src/modules/feeds/entities/aggregation-job.entity.ts`
- `apps/web/src/widgets/dashboard/ui/FeedActivity.vue`

**Phase 6 - Polish:**
- `apps/api/src/modules/health/health.controller.ts`
- `apps/web/src/widgets/dashboard/ui/StatusWidget.vue`

---

## Existing Patterns to Reuse

**Backend:**
- **Module structure:** Follow `auth.module.ts` pattern (TypeOrmModule.forFeature, providers, exports)
- **Service:** Follow `auth.service.ts` pattern (dependency injection, private utility methods)
- **Entity:** Follow `user.entity.ts` pattern (@Entity, @Column, @CreateDateColumn, relations)
- **Controller:** Follow `auth.controller.ts` pattern (@CurrentUser decorator, HTTP status codes, Swagger docs)
- **DTOs:** Use class-validator decorators (@IsString, @IsOptional, @MinLength, etc.)

**Frontend:**
- **Store:** Follow `feedStore.ts` existing pattern (state/computed/actions, extractError utility, toast notifications)
- **API:** Follow `feedApi.ts` pattern (function returning methods object)
- **Middleware:** Reuse existing `auth.ts` and `telegram-connected.ts`
- **Pages:** Follow FSD architecture (pages are thin, widgets contain logic)

---

## End-to-End Verification Plan

After all phases complete, perform this comprehensive test:

1. **Setup:**
   - Create new user account
   - Connect Telegram account via QR/phone
   - Verify bot auto-created

2. **Feed Creation:**
   - Navigate to "Create Feed"
   - Search for public channel (e.g., "tech")
   - Select 2-3 source channels
   - Create feed with name "My Tech Feed"
   - Verify feed appears in dashboard as draft

3. **Channel Creation:**
   - Open feed detail page
   - Click "Create Channel" button
   - Wait for channel creation (should complete in 10-30s)
   - Verify invite link displayed
   - Click "Open in Telegram"
   - Join the created channel in Telegram app

4. **Message Flow:**
   - Wait for first sync cycle (based on polling interval)
   - Verify messages appear in feed channel
   - Check they're forwarded from sources
   - Verify attribution preserved

5. **Management:**
   - Add new source to feed
   - Trigger manual sync
   - Verify new messages appear
   - Pause feed
   - Verify no new syncs
   - Resume feed
   - Verify syncs restart

6. **Error Handling:**
   - Remove bot from channel (simulate error)
   - Verify feed marked as error
   - Fix issue
   - Verify recovery

**Success Criteria:**
- ✅ Feed created in &lt;5s
- ✅ Channel created in &lt;30s
- ✅ Messages forwarded within polling interval
- ✅ All operations reflected in UI immediately
- ✅ No console errors
- ✅ Graceful error handling throughout

---

## Dependencies & Prerequisites

**Environment:**
- Docker containers running: `aggregram-postgres`, `aggregram-redis`
- Backend running on port 3001
- Frontend running on port 3000
- Node.js 18+, pnpm 8+

**Existing Work:**
- Phase 1 auth implementation (users, refresh tokens)
- Telegram connection wizard (session management, bot factory)
- TDLib service basic setup

**External:**
- Telegram API access (via TDLib)
- Bot API access (user's bot token)
- Active user Telegram session

---

## Estimated Timeline

- **Phase 1:** 0.5 days (Database schema)
- **Phase 2:** 1 day (Feed CRUD)
- **Phase 3:** 1 day (Channel discovery)
- **Phase 4:** 1.5 days (Job queue & channel creation)
- **Phase 5:** 2 days (Message aggregation)
- **Phase 6:** 1 day (Error handling & polish)

**Total:** ~7 days of focused development
