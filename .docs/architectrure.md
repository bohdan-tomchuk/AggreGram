# AggreGram System Design

## Pure Aggregation Architecture with User-Owned Resources

---

## Overview

AggreGram creates personalized Telegram feed channels by aggregating content from public channels. Each user owns their Telegram session and bot — the service acts on their behalf.

### Core Principles

| Principle | Description |
|-----------|-------------|
| User-owned resources | User's session reads channels, user's bot posts to feeds |
| Zero pools | No service accounts or bot pools to manage |
| Infinite scalability | Limits distributed across users, not centralized |
| Session persistence | Regular activity keeps sessions alive indefinitely |
| Automated setup | Bot creation handled automatically via BotFather |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         AggreGram                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Web UI     │    │   REST API   │    │  Job Queue   │      │
│  │   (Nuxt 4)   │───▶│   (NestJS)   │───▶│  (BullMQ)    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                 │               │
│                                                 ▼               │
│                      ┌─────────────────────────────────────┐   │
│                      │         TDLib Service               │   │
│                      │  ┌─────────────────────────────┐    │   │
│                      │  │   Session Manager           │    │   │
│                      │  │   - User session storage    │    │   │
│                      │  │   - Health monitoring       │    │   │
│                      │  │   - Auto-reconnection       │    │   │
│                      │  └─────────────────────────────┘    │   │
│                      │  ┌─────────────────────────────┐    │   │
│                      │  │   Bot Factory               │    │   │
│                      │  │   - BotFather automation    │    │   │
│                      │  │   - Token extraction        │    │   │
│                      │  └─────────────────────────────┘    │   │
│                      │  ┌─────────────────────────────┐    │   │
│                      │  │   Channel Operations        │    │   │
│                      │  │   - Read source channels    │    │   │
│                      │  │   - Create feed channels    │    │   │
│                      │  │   - Post aggregated content │    │   │
│                      │  └─────────────────────────────┘    │   │
│                      └─────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │        Telegram APIs          │
                    │  ┌─────────┐  ┌───────────┐   │
                    │  │ MTProto │  │  Bot API  │   │
                    │  │ (TDLib) │  │           │   │
                    │  └─────────┘  └───────────┘   │
                    └───────────────────────────────┘
```

---

## User Flow

### First-Time Setup

```
User visits AggreGram
        │
        ▼
Creates account (email/OAuth)
        │
        ▼
Clicks "Connect Telegram"
        │
        ▼
Sees QR code or enters phone
        │
        ▼
Enters verification code
        │
        ▼
Enters 2FA password (if enabled)
        │
        ▼
Session stored ──────────────────┐
        │                        │
        ▼                        ▼
Bot auto-created ◀─── Service chats with BotFather
        │                        │
        ▼                        ▼
"Setup complete!"         Bot token stored
```

### Creating a Feed

```
User clicks "New Feed"
        │
        ▼
Names the feed
        │
        ▼
Searches/selects source channels
        │
        ▼
Clicks "Create Channel"
        │
        ▼
User's bot creates Telegram channel
        │
        ▼
Invite link displayed
        │
        ▼
User joins feed channel
        │
        ▼
Posts start appearing automatically
```

### Ongoing Aggregation

```
┌─────────────────────────────────────────────┐
│              Aggregation Loop               │
│                                             │
│  Scheduler triggers (every 1-5 min)         │
│          │                                  │
│          ▼                                  │
│  For each active feed:                      │
│          │                                  │
│          ▼                                  │
│  TDLib fetches new messages                 │
│  (using user's session)                     │
│          │                                  │
│          ▼                                  │
│  Filter by feed settings                    │
│          │                                  │
│          ▼                                  │
│  Bot forwards to feed channel               │
│  (using user's bot)                         │
│          │                                  │
│          ▼                                  │
│  Update last_message_id checkpoint          │
│          │                                  │
│          └──────────── loop ────────────────┘
│                                             │
└─────────────────────────────────────────────┘
```

---

## Data Model

### Users

```
users
├── id                      UUID
├── email                   String
├── password_hash           String
├── created_at              Timestamp
└── updated_at              Timestamp
```

### Telegram Connections

```
telegram_connections
├── id                      UUID
├── user_id                 UUID (FK → users)
├── telegram_user_id        BigInt
├── phone_number            String (encrypted)
├── session_data            Text (encrypted)
├── session_status          Enum: active, expired, revoked
├── last_activity_at        Timestamp
├── created_at              Timestamp
└── updated_at              Timestamp
```

### User Bots

```
user_bots
├── id                      UUID
├── user_id                 UUID (FK → users)
├── bot_token               String (encrypted)
├── bot_username            String
├── bot_telegram_id         BigInt
├── status                  Enum: active, revoked, error
├── created_at              Timestamp
└── updated_at              Timestamp
```

### Source Channels

```
source_channels
├── id                      UUID
├── telegram_channel_id     BigInt
├── username                String
├── title                   String
├── description             Text (nullable)
├── subscriber_count        Integer (nullable)
├── avatar_url              String (nullable)
├── last_metadata_sync      Timestamp
├── created_at              Timestamp
└── updated_at              Timestamp
```

### Feeds

```
feeds
├── id                      UUID
├── user_id                 UUID (FK → users)
├── name                    String
├── description             Text (nullable)
├── status                  Enum: draft, active, paused, error
├── polling_interval_sec    Integer (default: 300)
├── created_at              Timestamp
└── updated_at              Timestamp
```

### Feed Sources (Junction)

```
feed_sources
├── id                      UUID
├── feed_id                 UUID (FK → feeds)
├── source_channel_id       UUID (FK → source_channels)
├── last_message_id         BigInt (nullable)
├── added_at                Timestamp
└── UNIQUE(feed_id, source_channel_id)
```

### Feed Channels (Output)

```
feed_channels
├── id                      UUID
├── feed_id                 UUID (FK → feeds, unique)
├── telegram_channel_id     BigInt
├── invite_link             String
├── title                   String
├── created_at              Timestamp
└── updated_at              Timestamp
```

### Aggregation Jobs

```
aggregation_jobs
├── id                      UUID
├── feed_id                 UUID (FK → feeds)
├── status                  Enum: pending, running, completed, failed
├── messages_fetched        Integer
├── messages_posted         Integer
├── error_message           Text (nullable)
├── started_at              Timestamp (nullable)
├── completed_at            Timestamp (nullable)
├── created_at              Timestamp
└── updated_at              Timestamp
```

---

## TDLib Service

### Session Manager

Handles user Telegram sessions lifecycle.

#### Responsibilities

| Function | Description |
|----------|-------------|
| Authentication | QR code and phone number flows |
| Session storage | Encrypted persistence in database |
| Health monitoring | Detect expired/revoked sessions |
| Auto-reconnection | Reconnect on network issues |
| Activity tracking | Log last activity for session health |

#### Session States

```
┌─────────────┐
│   created   │
└──────┬──────┘
       │ user initiates auth
       ▼
┌─────────────┐
│  awaiting   │
│    code     │◀──────────────────┐
└──────┬──────┘                   │
       │ code entered             │
       ▼                          │
┌─────────────┐                   │
│  awaiting   │ (if 2FA enabled)  │
│    2FA      │                   │
└──────┬──────┘                   │
       │ password entered         │
       ▼                          │
┌─────────────┐                   │
│   active    │───────────────────┤
└──────┬──────┘  session revoked  │
       │                          │
       │ inactivity / error       │
       ▼                          │
┌─────────────┐                   │
│   expired   │───────────────────┘
└─────────────┘  user re-auths
```

#### Session Persistence

Sessions remain alive when service makes regular API calls:

| Activity Type | Frequency | Keeps Alive |
|---------------|-----------|-------------|
| Fetch channel messages | Every 1-5 min | Yes |
| Get channel info | On demand | Yes |
| Health check ping | Daily minimum | Yes |

**Inactive sessions expire after ~6 months.**
**Active sessions live indefinitely.**

---

### Bot Factory

Automates bot creation via BotFather.

#### Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Bot Creation Sequence                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Service                          BotFather                     │
│     │                                │                          │
│     │  ───── "/newbot" ─────────▶    │                          │
│     │                                │                          │
│     │  ◀─── "Send name..." ───────   │                          │
│     │                                │                          │
│     │  ───── "AggreGram Feed" ───▶   │                          │
│     │                                │                          │
│     │  ◀─── "Pick username..." ───   │                          │
│     │                                │                          │
│     │  ───── "agrgrm_a8k2_bot" ──▶   │                          │
│     │                                │                          │
│     │  ◀─── "Done! Token: ..." ───   │                          │
│     │                                │                          │
│     ▼                                                           │
│  Parse token from response                                      │
│     │                                                           │
│     ▼                                                           │
│  Store encrypted in database                                    │
│     │                                                           │
│     ▼                                                           │
│  Bot ready for use                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Username Generation

```
Pattern: agrgrm_{random_6_chars}_bot

Examples:
- agrgrm_x8k2m9_bot
- agrgrm_p3n7q1_bot
- agrgrm_w5t9y2_bot
```

#### Error Handling

| Error | Response |
|-------|----------|
| Username taken | Retry with new random suffix |
| Rate limited | Queue and retry with delay |
| Bot limit reached (20) | Inform user, suggest cleanup |
| Unexpected response | Log, retry, alert if persistent |

#### BotFather Response Parsing

Token extraction regex:
```
/(\d+:[A-Za-z0-9_-]+)/
```

Example response:
```
Done! Congratulations on your new bot. You will find it at t.me/agrgrm_x8k2m9_bot.
Use this token to access the HTTP API:
7123456789:AAF8kP9x2mN3qW5vL1cK7hJ4dR6gY0tZ2sM
```

---

### Channel Operations

#### Reading Source Channels

Uses user's TDLib session to fetch messages.

| Operation | Method |
|-----------|--------|
| Get channel by username | `searchPublicChat` |
| Get message history | `getChatHistory` |
| Get channel info | `getChat`, `getSupergroupFullInfo` |

#### Creating Feed Channels

Uses user's bot via Bot API.

| Operation | Method |
|-----------|--------|
| Create channel | Bot creates via `createChannel` (TDLib as bot) |
| Set title | `setChatTitle` |
| Set description | `setChatDescription` |
| Get invite link | `exportChatInviteLink` |

**Note:** Bot API cannot create channels directly. Options:

1. **TDLib as bot** — Use TDLib with bot token to create channel
2. **User session creates** — User's TDLib session creates channel, bot added as admin

**Recommended: User session creates channel, adds bot as admin.**

#### Posting to Feed Channels

Uses user's bot token via Bot API.

| Operation | Method |
|-----------|--------|
| Forward message | `forwardMessage` |
| Send message | `sendMessage` |
| Send media | `sendPhoto`, `sendVideo`, etc. |

---

## Job Queue System

### Queue Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BullMQ Queues                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  auth-queue     │  Bot creation, session management          │
│  │  Concurrency: 1 │  Rate: 1 job per 3 seconds                 │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  fetch-queue    │  Fetch messages from sources               │
│  │  Concurrency: 5 │  Per-user rate limiting                    │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  post-queue     │  Post to feed channels                     │
│  │  Concurrency: 3 │  Per-bot rate limiting                     │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  health-queue   │  Session health checks                     │
│  │  Concurrency: 2 │  Rate: 1 check per minute                  │
│  └─────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Job Types

#### `create-bot`

```
{
  type: "create-bot",
  userId: "uuid",
  retryCount: 0
}
```

#### `fetch-feed-sources`

```
{
  type: "fetch-feed-sources",
  feedId: "uuid",
  sourceChannelIds: ["uuid", ...],
  since: "last_message_id"
}
```

#### `post-to-feed`

```
{
  type: "post-to-feed",
  feedId: "uuid",
  messages: [
    { sourceChannelId: "uuid", messageId: 12345 },
    ...
  ]
}
```

#### `health-check`

```
{
  type: "health-check",
  userId: "uuid",
  checkType: "session" | "bot"
}
```

### Scheduling

| Job | Trigger |
|----|---------|
| Fetch sources | Cron based on feed's `polling_interval_sec` |
| Post to feed | After successful fetch |
| Health check | Daily per user |
| Bot creation | On user setup completion |

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |

### Telegram Connection

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/telegram/connect/init` | Start auth, get QR code |
| POST | `/telegram/connect/phone` | Submit phone number |
| POST | `/telegram/connect/code` | Submit verification code |
| POST | `/telegram/connect/2fa` | Submit 2FA password |
| GET | `/telegram/connection` | Get connection status |
| DELETE | `/telegram/connection` | Disconnect Telegram |

### Feeds

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/feeds` | List user's feeds |
| POST | `/feeds` | Create feed |
| GET | `/feeds/:id` | Get feed details |
| PATCH | `/feeds/:id` | Update feed |
| DELETE | `/feeds/:id` | Delete feed |
| POST | `/feeds/:id/channel` | Create Telegram channel for feed |
| GET | `/feeds/:id/channel/invite` | Get invite link |
| POST | `/feeds/:id/pause` | Pause aggregation |
| POST | `/feeds/:id/resume` | Resume aggregation |
| POST | `/feeds/:id/sync` | Trigger manual sync |

### Feed Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/feeds/:id/sources` | List feed sources |
| POST | `/feeds/:id/sources` | Add source to feed |
| DELETE | `/feeds/:id/sources/:sourceId` | Remove source |

### Channel Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/channels/search?q=` | Search public channels |
| GET | `/channels/:username` | Get channel info |
| GET | `/channels/subscriptions` | User's Telegram subscriptions |

### Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status/connection` | Telegram connection health |
| GET | `/status/bot` | Bot health |
| GET | `/status/feeds` | All feeds status summary |

---

## Frontend Pages

### Page Structure (FSD)

```
pages/
├── index.vue                    Landing / Dashboard
├── auth/
│   ├── login.vue
│   └── register.vue
├── setup/
│   └── telegram.vue             Telegram connection wizard
├── feeds/
│   ├── index.vue                Feed list
│   ├── new.vue                  Create feed
│   └── [id]/
│       ├── index.vue            Feed detail
│       ├── edit.vue             Edit feed
│       └── sources.vue          Manage sources
└── settings/
    └── index.vue                Account settings
```

### Key UI Components

#### Telegram Connection Wizard

```
┌─────────────────────────────────────────┐
│         Connect Your Telegram           │
├─────────────────────────────────────────┤
│                                         │
│     ┌───────────────────────┐           │
│     │                       │           │
│     │      [QR CODE]        │           │
│     │                       │           │
│     └───────────────────────┘           │
│                                         │
│     Scan with Telegram app              │
│                                         │
│     ─────── or ───────                  │
│                                         │
│     [Enter phone number instead]        │
│                                         │
└─────────────────────────────────────────┘
```

#### Feed Creation

```
┌─────────────────────────────────────────┐
│            Create New Feed              │
├─────────────────────────────────────────┤
│                                         │
│  Feed Name                              │
│  ┌─────────────────────────────────┐    │
│  │ Tech News Digest                │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Source Channels (3 selected)           │
│  ┌─────────────────────────────────┐    │
│  │ 🔍 Search channels...           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ☑ @techcrunch                   │    │
│  │ ☑ @TheVerge                     │    │
│  │ ☑ @hackernews                   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [ Create Feed Channel ]                │
│                                         │
└─────────────────────────────────────────┘
```

#### Feed Dashboard

```
┌─────────────────────────────────────────┐
│              Your Feeds                 │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 📰 Tech News Digest             │    │
│  │ 3 sources • Last sync: 2m ago   │    │
│  │ ● Active     [Open] [Edit] [⋯]  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🎮 Gaming News                  │    │
│  │ 5 sources • Last sync: 5m ago   │    │
│  │ ● Active     [Open] [Edit] [⋯]  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [ + New Feed ]                         │
│                                         │
└─────────────────────────────────────────┘
```

---

## Security Considerations

### Data Encryption

| Data | Storage | Encryption |
|------|---------|------------|
| Session data | PostgreSQL | AES-256-GCM |
| Bot tokens | PostgreSQL | AES-256-GCM |
| Phone numbers | PostgreSQL | AES-256-GCM |

### Encryption Key Management

- Master key in environment variable
- Key rotation support
- Per-user salt for session data

### Authentication

- JWT tokens for API auth
- Refresh token rotation
- Session expiry: 7 days (configurable)

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Auth endpoints | 5/min per IP |
| API endpoints | 100/min per user |
| Telegram operations | Managed by job queue |

---

## Monitoring & Health

### Metrics to Track

| Metric | Purpose |
|--------|---------|
| Active sessions count | System health |
| Expired sessions count | Re-auth needed |
| Messages fetched/hour | Throughput |
| Messages posted/hour | Throughput |
| Job queue depth | Backlog detection |
| Error rate by type | Issue identification |

### Alerts

| Condition | Action |
|-----------|--------|
| Session expired | Notify user via email |
| Bot revoked | Notify user, pause feeds |
| High error rate | Alert admin |
| Job queue backed up | Alert admin |

### Health Check Endpoints

| Endpoint | Checks |
|----------|--------|
| `/health` | API responding |
| `/health/db` | Database connection |
| `/health/redis` | Redis connection |
| `/health/tdlib` | TDLib service |

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

| Task | Priority |
|------|----------|
| Database schema setup | P0 |
| TDLib service skeleton | P0 |
| Session manager (auth flow) | P0 |
| Basic API structure | P0 |

### Phase 2: Bot & Channel Creation (Week 2)

| Task | Priority |
|------|----------|
| BotFather automation | P0 |
| Channel creation via user session | P0 |
| Bot admin assignment | P0 |
| Invite link generation | P0 |

### Phase 3: Aggregation Engine (Week 2-3)

| Task | Priority |
|------|----------|
| Job queue setup | P0 |
| Source channel fetching | P0 |
| Message forwarding | P0 |
| Checkpoint tracking | P0 |

### Phase 4: Frontend (Week 3-4)

| Task | Priority |
|------|----------|
| Auth pages | P0 |
| Telegram connection wizard | P0 |
| Feed CRUD | P0 |
| Source selection | P0 |
| Feed dashboard | P0 |

### Phase 5: Polish & Monitoring (Week 4)

| Task | Priority |
|------|----------|
| Error handling improvements | P1 |
| Health checks | P1 |
| Basic monitoring | P1 |
| User notifications | P1 |

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | Nuxt 4, TypeScript, TailwindCSS |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| Cache/Queue | Redis, BullMQ |
| Telegram | TDLib (node bindings) |
| Auth | JWT |
| Deployment | Docker |

---

## Open Questions

| Question | Options | Decision Needed |
|----------|---------|-----------------|
| TDLib bindings | tdl, @aspect/tdlib, custom | Evaluate stability |
| Channel creation | User session vs TDLib-as-bot | Test both approaches |
| Message format | Forward vs repost | Start with forward |
| Re-auth UX | Email notification vs in-app only | Both probably |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TDLib complexity | Medium | High | Start simple, iterate |
| BotFather format changes | Low | Medium | Flexible parsing, monitoring |
| User revokes session | Medium | Low | Clear re-auth flow |
| Telegram policy changes | Low | High | Monitor ToS, stay compliant |
| TDLib node bindings unstable | Medium | High | Have Telethon fallback plan |