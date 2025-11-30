# Telegram Channel Crawler

A multi-user web application that aggregates posts from public Telegram channels into a unified, searchable feed with filtering, channel management, and full-text search capabilities.

---

## 1. Overview

### Problem Statement
Monitoring multiple Telegram news channels requires constant app-switching and manual tracking. Teams lack a centralized solution to aggregate, search, and filter content across channels, leading to missed information and inefficient workflows.

### Target Users
- News aggregation teams and media monitors
- Research analysts tracking industry channels
- Small teams (1-3 users for MVP) requiring shared channel monitoring

### Success Metrics (MVP)
- Successfully crawl and index up to 100 public Telegram channels
- Sub-2 second search response time across aggregated posts
- 15-30 minute maximum delay for new post ingestion
- Support 1-3 concurrent users with shared channel access

### Constraints
- Hardware: 8GB RAM, Intel i5 9th gen (home server)
- Public channels only for MVP (private channels in future)
- Text and media content (reactions, comments in future)
- Storage optimization via on-demand media fetching

---

## 2. Functional Decomposition (WHAT)

### Capability: Authentication
| Feature | Description | Inputs | Outputs | Behavior |
|---------|-------------|--------|---------|----------|
| User Login | Authenticate user with email/password | email, password | JWT access token, refresh token | Validate credentials, generate tokens, return user info |
| Token Refresh | Exchange refresh token for new access token | refresh token | new access token | Validate refresh token, generate new access token |
| Logout | Invalidate user session | refresh token | success status | Revoke refresh token in database |
| Get Current User | Retrieve authenticated user profile | access token (header) | user object | Decode token, return user data |

### Capability: Channel Management
| Feature | Description | Inputs | Outputs | Behavior |
|---------|-------------|--------|---------|----------|
| Add Channel | Subscribe to a Telegram channel | channel username or link | channel object | Resolve channel via Telegram API, store metadata, queue initial crawl |
| List Channels | Get all monitored channels | filters (topic, type, active) | paginated channel list | Query channels with filters, include stats |
| Update Channel Profile | Modify channel metadata | channel_id, topic, type | updated channel | Update profile fields in database |
| Remove Channel | Stop monitoring a channel | channel_id | success status | Soft delete, optionally retain posts |
| Refresh Channel Metadata | Force update subscriber count, description | channel_id | updated channel | Fetch latest data from Telegram, update record |
| Auto-Update Metadata | Background sync of channel info | none (scheduled) | updated channels | Periodic job to refresh stale metadata (>24h) |

### Capability: Post Aggregation
| Feature | Description | Inputs | Outputs | Behavior |
|---------|-------------|--------|---------|----------|
| Unified Feed | Display posts from all channels | pagination, filters | paginated post list | Join posts with channels, apply filters, sort by date |
| Filter by Date Range | Narrow feed to date range | date_from, date_to | filtered posts | Apply date constraints to query |
| Filter by Topic | Show posts from channels with specific topic | topic | filtered posts | Join with channels, filter by topic |
| View Post Detail | Get single post with full info | post_id | post object | Return post with channel info, media references |
| Fetch Media On-Demand | Retrieve full media for a post | post_id | media binary/URL | Use Telegram file_id to download, cache temporarily |

### Capability: Search
| Feature | Description | Inputs | Outputs | Behavior |
|---------|-------------|--------|---------|----------|
| Full-Text Search | Search across all post content | query string, filters | ranked post list | Use PostgreSQL tsvector, apply filters, rank results |
| Search with Highlights | Return matching text snippets | query string | posts with highlights | Use ts_headline for context snippets |
| Combine Search + Filters | Apply date/topic filters to search | query, filters | filtered search results | Merge full-text search with filter constraints |

### Capability: Crawler Service
| Feature | Description | Inputs | Outputs | Behavior |
|---------|-------------|--------|---------|----------|
| Scheduled Crawl | Periodic check for new posts | none (cron-triggered) | new posts ingested | Queue jobs for active channels every 20 minutes |
| Incremental Fetch | Get only new posts since last crawl | channel_id, last_post_id | new posts | Fetch messages with id > last_post_id |
| Parse Post Content | Extract text and media references | raw Telegram message | structured post data | Extract text, identify media type, store file_id |
| Generate Thumbnails | Create small previews for photos | photo file_id | thumbnail path | Download photo, resize to 200x200, save locally |
| Handle Rate Limits | Respect Telegram flood protection | FloodWait error | delayed retry | Pause crawling, schedule retry after wait period |
| Session Management | Maintain Telegram connection | API credentials | active session | Persist session, reconnect on failure |

---

## 3. Structural Decomposition (HOW)

### Repository Structure

```
telegram-crawler/
├── apps/
│   ├── web/                           # Nuxt 4 Frontend
│   │   ├── src/
│   │   │   ├── app/                   # App layer (FSD)
│   │   │   │   ├── providers/
│   │   │   │   └── styles/
│   │   │   ├── pages/                 # Nuxt pages
│   │   │   │   ├── index.vue
│   │   │   │   ├── channels/
│   │   │   │   ├── search.vue
│   │   │   │   └── auth/
│   │   │   ├── widgets/               # Composite UI blocks
│   │   │   │   ├── feed/
│   │   │   │   ├── channel-list/
│   │   │   │   ├── search-bar/
│   │   │   │   └── header/
│   │   │   ├── features/              # User interactions
│   │   │   │   ├── add-channel/
│   │   │   │   ├── filter-posts/
│   │   │   │   ├── search-posts/
│   │   │   │   └── auth/
│   │   │   ├── entities/              # Business entities
│   │   │   │   ├── post/
│   │   │   │   ├── channel/
│   │   │   │   └── user/
│   │   │   └── shared/                # Utilities
│   │   │       ├── api/
│   │   │       ├── ui/
│   │   │       ├── lib/
│   │   │       └── config/
│   │   ├── nuxt.config.ts
│   │   └── package.json
│   │
│   └── api/                           # NestJS Backend
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── common/
│       │   │   ├── decorators/
│       │   │   ├── guards/
│       │   │   ├── interceptors/
│       │   │   ├── filters/
│       │   │   └── dto/
│       │   ├── config/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── channels/
│       │   │   ├── posts/
│       │   │   └── crawler/
│       │   └── database/
│       │       ├── migrations/
│       │       └── entities/
│       └── package.json
│
├── packages/                          # Shared packages
│   └── types/                         # Shared TypeScript types
│
├── docker-compose.yml
├── package.json                       # Monorepo root
└── pnpm-workspace.yaml
```

### Module-to-Capability Mapping

| Capability | Frontend Location | Backend Location |
|------------|-------------------|------------------|
| Authentication | `features/auth/` | `modules/auth/` |
| Channel Management | `features/add-channel/`, `entities/channel/` | `modules/channels/` |
| Post Aggregation | `entities/post/`, `widgets/feed/` | `modules/posts/` |
| Search | `features/search-posts/`, `widgets/search-bar/` | `modules/posts/` (search endpoint) |
| Crawler Service | N/A | `modules/crawler/` |
| Filtering | `features/filter-posts/` | Query params in `modules/posts/` |

---

## 4. Dependency Graph

### Foundation Layer (Phase 0) - No Dependencies

```
foundation-layer:
  - shared-types:          # TypeScript types/interfaces
      depends_on: []
  - database-setup:        # PostgreSQL schema, migrations
      depends_on: []
  - config-module:         # Environment configuration
      depends_on: []
  - error-handling:        # Exception filters, error types
      depends_on: []
```

### Infrastructure Layer (Phase 1)

```
infrastructure-layer:
  - database-entities:     # TypeORM entities
      depends_on: [database-setup, shared-types]
  - redis-setup:           # Redis connection for BullMQ
      depends_on: [config-module]
  - jwt-setup:             # JWT strategy, guards
      depends_on: [config-module, error-handling]
```

### Core Backend Layer (Phase 2)

```
core-backend-layer:
  - users-module:
      depends_on: [database-entities, error-handling]
  - auth-module:
      depends_on: [users-module, jwt-setup]
  - channels-module:
      depends_on: [database-entities, auth-module]
  - posts-module:
      depends_on: [database-entities, channels-module, auth-module]
```

### Crawler Layer (Phase 3)

```
crawler-layer:
  - telegram-service:      # GramJS wrapper
      depends_on: [config-module, error-handling]
  - crawler-jobs:          # BullMQ job definitions
      depends_on: [redis-setup, channels-module, posts-module]
  - crawler-processors:    # Job execution logic
      depends_on: [telegram-service, crawler-jobs, posts-module]
  - media-processor:       # Thumbnail generation
      depends_on: [telegram-service, config-module]
```

### Frontend Foundation Layer (Phase 4)

```
frontend-foundation-layer:
  - shared-api-client:     # Axios/fetch setup with interceptors
      depends_on: [shared-types, config-module]
  - shared-ui:             # Base components (or Nuxt UI config)
      depends_on: []
  - auth-feature:          # Login, token management
      depends_on: [shared-api-client]
```

### Frontend Entity Layer (Phase 5)

```
frontend-entity-layer:
  - user-entity:
      depends_on: [shared-types, shared-api-client]
  - channel-entity:
      depends_on: [shared-types, shared-api-client]
  - post-entity:
      depends_on: [shared-types, shared-api-client, channel-entity]
```

### Frontend Feature Layer (Phase 6)

```
frontend-feature-layer:
  - add-channel-feature:
      depends_on: [channel-entity, auth-feature]
  - filter-posts-feature:
      depends_on: [post-entity, channel-entity]
  - search-posts-feature:
      depends_on: [post-entity, shared-api-client]
```

### Frontend Widget Layer (Phase 7)

```
frontend-widget-layer:
  - header-widget:
      depends_on: [auth-feature, user-entity]
  - feed-widget:
      depends_on: [post-entity, filter-posts-feature]
  - channel-list-widget:
      depends_on: [channel-entity, add-channel-feature]
  - search-bar-widget:
      depends_on: [search-posts-feature]
```

### Pages Layer (Phase 8)

```
pages-layer:
  - login-page:
      depends_on: [auth-feature]
  - feed-page:
      depends_on: [header-widget, feed-widget, search-bar-widget]
  - channels-page:
      depends_on: [header-widget, channel-list-widget]
  - search-page:
      depends_on: [header-widget, search-bar-widget, feed-widget]
```

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Entry Criteria:** Project requirements finalized
**Exit Criteria:** Users can log in and see empty dashboard

**Tasks:**
1. Initialize monorepo with pnpm workspaces
2. Set up Nuxt 4 with FSD structure and Nuxt UI v3
3. Set up NestJS with module structure
4. Configure PostgreSQL with TypeORM
5. Create database migrations for all entities
6. Implement JWT authentication (access + refresh tokens)
7. Create login page and auth flow
8. Set up basic app shell with header

**Deliverables:**
- Working monorepo structure
- Database with all tables created
- Functional login/logout flow
- Protected route structure

### Phase 2: Core Crawler (Week 3-4)
**Entry Criteria:** Auth system working
**Exit Criteria:** Add channels and see text posts in feed

**Tasks:**
1. Set up Redis and BullMQ
2. Implement GramJS Telegram service with session persistence
3. Create channel add/list/remove endpoints
4. Implement channel management UI
5. Build basic crawl job processor (text only)
6. Create posts table population
7. Implement basic feed display

**Deliverables:**
- Channels CRUD working
- Crawler fetching text posts
- Basic feed showing posts

### Phase 3: Media & Search (Week 5-6)
**Entry Criteria:** Text posts displaying correctly
**Exit Criteria:** Media display and working search

**Tasks:**
1. Implement thumbnail generation for photos
2. Build on-demand media fetching endpoint
3. Add media display to post cards
4. Set up PostgreSQL full-text search with tsvector
5. Create search endpoint with highlighting
6. Build search UI with result display
7. Implement search result highlighting

**Deliverables:**
- Photo thumbnails in feed
- Full media on click
- Working full-text search

### Phase 4: Polish (Week 7-8)
**Entry Criteria:** Core features functional
**Exit Criteria:** Production-ready MVP

**Tasks:**
1. Implement date range filter
2. Implement topic filter
3. Add channel metadata auto-refresh job
4. Handle edge cases and errors gracefully
5. Optimize database queries and indexes
6. Set up Docker deployment
7. Create production configuration
8. Write deployment documentation

**Deliverables:**
- All filters working
- Error handling complete
- Docker deployment ready
- Documentation complete

---

## 6. User Stories and Acceptance Criteria

### Authentication

**US-001: User Login**
- ID: AUTH-001
- As a user, I can log in with email and password to access the dashboard
- Acceptance Criteria:
  - Login form with email and password fields
  - Form validation with error messages
  - Successful login redirects to feed page
  - Failed login shows appropriate error
  - Access token stored securely in memory
  - Refresh token stored in httpOnly cookie

**US-002: Session Persistence**
- ID: AUTH-002
- As a user, my session persists via refresh token
- Acceptance Criteria:
  - Page refresh maintains logged-in state
  - Expired access token triggers automatic refresh
  - Failed refresh redirects to login

**US-003: Logout**
- ID: AUTH-003
- As a user, I can log out to end my session
- Acceptance Criteria:
  - Logout button visible in header
  - Clicking logout clears tokens
  - User redirected to login page
  - Refresh token revoked server-side

### Channel Management

**US-004: Add Channel**
- ID: CHAN-001
- As a user, I can add a Telegram channel by entering its @username
- Acceptance Criteria:
  - Input field accepts @username or t.me/ link
  - System resolves and validates channel exists
  - Channel added to list with metadata
  - Initial crawl queued automatically
  - Error shown if channel not found or private

**US-005: Assign Topic**
- ID: CHAN-002
- As a user, I can assign a topic to a channel
- Acceptance Criteria:
  - Dropdown/select for topic field
  - Predefined topic options available
  - Topic saved and reflected in list
  - Topic usable as filter criteria

**US-006: Set Channel Type**
- ID: CHAN-003
- As a user, I can set the channel type (news, personal_blog, official)
- Acceptance Criteria:
  - Type selector on channel edit
  - Three options: news, personal_blog, official
  - Type persisted to database

**US-007: View Channel Details**
- ID: CHAN-004
- As a user, I can view channel details including subscriber count
- Acceptance Criteria:
  - Channel detail view shows: title, description, subscribers, last crawl time
  - Data reflects auto-updated values

**US-008: Remove Channel**
- ID: CHAN-005
- As a user, I can remove a channel from monitoring
- Acceptance Criteria:
  - Delete button with confirmation
  - Channel marked inactive (soft delete)
  - Posts optionally retained
  - Channel removed from feed

**US-009: Auto-Update Metadata**
- ID: CHAN-006
- As a user, channel metadata updates automatically
- Acceptance Criteria:
  - Subscriber count refreshes every 24 hours
  - Description updates if changed
  - Last updated timestamp visible

### Feed & Posts

**US-010: Unified Feed**
- ID: FEED-001
- As a user, I can view a unified feed of posts from all monitored channels
- Acceptance Criteria:
  - Feed shows posts from all active channels
  - Posts sorted by date (newest first)
  - Infinite scroll or pagination
  - Loading states shown

**US-011: Post Display**
- ID: FEED-002
- As a user, posts display channel name, text, date, and thumbnail
- Acceptance Criteria:
  - Post card shows: channel badge, text preview, timestamp
  - Photo posts show thumbnail
  - Truncated text with "show more" for long posts

**US-012: Full Media View**
- ID: FEED-003
- As a user, I can click on a post to view full media
- Acceptance Criteria:
  - Clicking thumbnail opens full image
  - Loading indicator while fetching
  - Media cached for 24 hours

**US-013: Default Sort**
- ID: FEED-004
- As a user, posts are sorted by date (newest first) by default
- Acceptance Criteria:
  - Feed loads with newest posts at top
  - Consistent ordering across page loads

### Filtering & Search

**US-014: Date Range Filter**
- ID: FILT-001
- As a user, I can filter posts by date range
- Acceptance Criteria:
  - Date picker for from/to dates
  - Filter applied immediately
  - Clear button to reset
  - URL updated with filter params

**US-015: Topic Filter**
- ID: FILT-002
- As a user, I can filter posts by channel topic
- Acceptance Criteria:
  - Topic dropdown filter
  - Shows only posts from channels with selected topic
  - Multiple topics selectable (OR logic)

**US-016: Full-Text Search**
- ID: SRCH-001
- As a user, I can perform full-text search across all posts
- Acceptance Criteria:
  - Search input in header/search page
  - Results ranked by relevance
  - Search works across all post text
  - Response time < 2 seconds

**US-017: Search Highlighting**
- ID: SRCH-002
- As a user, search results highlight matching terms
- Acceptance Criteria:
  - Matched terms visually highlighted
  - Context snippet shown around match

**US-018: Shareable Filters**
- ID: FILT-003
- As a user, filter state persists in URL
- Acceptance Criteria:
  - Filter changes update URL query params
  - Copying URL preserves filter state
  - Direct link to filtered view works

### Database Modeling

**US-019: Database Schema**
- ID: DB-001
- As a developer, database supports all required entities
- Acceptance Criteria:
  - Users table with auth fields
  - Channels table with profile and crawler state
  - Posts table with content and search vector
  - Refresh tokens table
  - Proper indexes for performance
  - Foreign key relationships defined

---

## 7. Technical Requirements / Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Nuxt | 4.x | SSR Vue framework |
| Vue | 3.x | UI library |
| Nuxt UI | 3.x (latest stable) | Component library |
| Tailwind CSS | 4.x | Styling |
| TypeScript | 5.x | Type safety |
| Pinia | 2.x | State management |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 10.x | API framework |
| TypeORM | 0.3.x | Database ORM |
| PostgreSQL | 16.x | Primary database |
| Redis | 7.x | Job queue, caching |
| BullMQ | 5.x | Background jobs |
| GramJS | latest | Telegram MTProto client |
| bcrypt | 5.x | Password hashing |
| jsonwebtoken | 9.x | JWT handling |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker + Docker Compose | Containerization |
| pnpm | Package manager |
| Monorepo (pnpm workspaces) | Code organization |

### Performance Requirements
| Metric | Target |
|--------|--------|
| Feed page load | < 2 seconds |
| Search response | < 2 seconds |
| API response (p95) | < 500ms |
| Concurrent users | 3 |
| Channels supported | 100 |

### Security Requirements
- Passwords hashed with bcrypt (cost factor 12)
- JWT access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry, stored hashed
- HTTPS only in production
- Telegram session encrypted at rest

---

## 8. Design and User Interface

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER                                                      │
│  [Logo]  [Search Input...          ]  [User Menu ▼]         │
├─────────────────────────────────────────────────────────────┤
│  SIDEBAR          │  MAIN CONTENT                            │
│                   │                                          │
│  Channels         │  FEED                                    │
│  ├─ All           │  ┌────────────────────────────────────┐ │
│  ├─ Technology    │  │ Channel Name · 2h ago               │ │
│  ├─ Finance       │  │ Post text content preview...        │ │
│  └─ [+ Add]       │  │ [Thumbnail]                         │ │
│                   │  └────────────────────────────────────┘ │
│  Filters          │  ┌────────────────────────────────────┐ │
│  ├─ Date Range    │  │ Another Channel · 5h ago            │ │
│  └─ Topic         │  │ More post content...                │ │
│                   │  └────────────────────────────────────┘ │
└───────────────────┴─────────────────────────────────────────┘
```

### Key UI Components
1. **Header Widget**: Logo, global search, user menu with logout
2. **Channel Sidebar**: Collapsible list of channels, add button, topic groups
3. **Feed Widget**: Infinite scroll post list, loading states
4. **Post Card**: Channel badge, text content, media thumbnail, timestamp
5. **Filter Panel**: Date pickers, topic checkboxes
6. **Search Results**: Ranked list with highlighted snippets
7. **Add Channel Modal**: Username input, topic/type selectors

### Design Principles
- Clean, minimal interface (Nuxt UI defaults)
- Responsive layout (desktop-first, mobile-friendly)
- Consistent spacing and typography
- Loading skeletons for async content
- Toast notifications for actions

---

## 9. Architecture & Risks

### System Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Nuxt 4)                            │
│   Feed Page  │  Channels Page  │  Search Page  │  Auth Pages        │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ REST API (JWT Auth)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (NestJS)                             │
│   Auth Module  │  Channels Module  │  Posts Module  │  Crawler      │
├─────────────────────────────────────────────────────────────────────┤
│                      CRAWLER SERVICE (GramJS)                        │
│   Channel Monitor  │  Post Fetcher  │  Media Resolver                │
└──────────────────┬────────────────────────────┬─────────────────────┘
                   │                            │
         ┌─────────▼─────────┐        ┌─────────▼─────────┐
         │    PostgreSQL     │        │      Redis        │
         │  • Users          │        │  • Job Queue      │
         │  • Channels       │        │  • Rate Limits    │
         │  • Posts          │        │  • Session Cache  │
         │  • Full-text      │        └───────────────────┘
         └───────────────────┘
                   │
         ┌─────────▼─────────┐
         │   File Storage    │
         │   (Local/MVP)     │
         │  • Thumbnails     │
         └───────────────────┘
```

### Data Models

**User**
```typescript
interface User {
  id: UUID;
  organization_id?: UUID;  // Future: multi-tenancy
  email: string;
  password_hash: string;
  name?: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

**Channel**
```typescript
interface Channel {
  id: UUID;
  organization_id?: UUID;
  telegram_id: bigint;
  username?: string;
  title: string;
  description?: string;
  subscriber_count?: number;
  photo_url?: string;
  topic: string;
  channel_type: 'news' | 'personal_blog' | 'official';
  is_active: boolean;
  last_crawled_at?: Date;
  last_post_id?: bigint;
  crawl_priority: number;  // 1-10
  created_at: Date;
  updated_at: Date;
}
```

**Post**
```typescript
interface Post {
  id: UUID;
  channel_id: UUID;
  telegram_post_id: bigint;
  text_content?: string;
  has_media: boolean;
  media_type?: 'photo' | 'video' | 'document';
  media_file_id?: string;
  media_thumbnail?: string;
  views?: number;
  forwards?: number;
  posted_at: Date;
  is_edited: boolean;
  edited_at?: Date;
  is_deleted: boolean;
  deleted_at?: Date;
  search_vector: tsvector;
  created_at: Date;
  updated_at: Date;
}
```

### Risk Assessment

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Telegram rate limits | High | High | Exponential backoff, staggered requests, respect FloodWait |
| Telegram ToS changes | Medium | Low | Monitor API updates, modular crawler design for quick adaptation |
| GramJS limitations | Medium | Medium | Document migration path to Python/Telethon, abstract crawler interface |
| Storage growth | Low | Medium | On-demand media, 24h cache purge, thumbnails only |
| Session invalidation | Medium | Medium | Persistent session storage, alert on auth failures, re-auth flow |
| Search performance degradation | Medium | Low | Proper indexes, query optimization, future Meilisearch migration path |

### Future Considerations (Designed for)
- **Multi-tenancy**: `organization_id` fields included but optional
- **LLM Integration**: Modular post processing pipeline
- **Real-time Updates**: Architecture supports WebSocket addition
- **Meilisearch**: Search module abstracted for easy swap
- **Python Crawler**: Interface defined for microservice extraction

---

## 10. Test Strategy

### Test Pyramid Ratios
- Unit Tests: 60%
- Integration Tests: 30%
- E2E Tests: 10%

### Coverage Requirements
- Backend: 80% line coverage minimum
- Frontend: 70% line coverage minimum
- Critical paths: 100% coverage

### Critical Test Scenarios

**Authentication**
- Valid login returns tokens
- Invalid credentials rejected
- Expired token triggers refresh
- Refresh token rotation works
- Logout invalidates session

**Channel Management**
- Valid channel resolves from Telegram
- Invalid channel username rejected
- Duplicate channel prevented
- Channel deletion stops crawling
- Metadata refresh updates fields

**Crawler**
- New posts ingested correctly
- Incremental fetch only gets new posts
- Rate limit handling pauses and retries
- Session reconnection after disconnect
- Thumbnail generation for photos

**Search**
- Full-text search returns relevant results
- Empty query handled gracefully
- Filters combine with search correctly
- Search highlighting accurate

### Test Environment
- Test database: Separate PostgreSQL instance
- Mock Telegram API for unit tests
- Real Telegram API for integration tests (test channels)
- Redis test instance for job testing

---

## 11. API Endpoints Reference

### Authentication
```
POST   /api/auth/login          # Login with credentials
POST   /api/auth/refresh        # Refresh access token
POST   /api/auth/logout         # Revoke refresh token
GET    /api/auth/me             # Get current user
```

### Channels
```
GET    /api/channels            # List channels (filterable)
POST   /api/channels            # Add new channel
GET    /api/channels/:id        # Get channel details
PATCH  /api/channels/:id        # Update channel profile
DELETE /api/channels/:id        # Remove channel
POST   /api/channels/:id/refresh # Force metadata refresh
```

### Posts
```
GET    /api/posts               # Paginated feed with filters
GET    /api/posts/search        # Full-text search
GET    /api/posts/:id           # Get single post
GET    /api/posts/:id/media     # Fetch full media on-demand
```

### Query Parameters (Posts)
```
channel_id    UUID      Filter by channel
topic         string    Filter by channel topic
date_from     ISO date  Start date
date_to       ISO date  End date
q             string    Search query (search endpoint)
sort          string    Sort field (default: date)
order         asc|desc  Sort order (default: desc)
page          number    Page number (default: 1)
limit         number    Items per page (default: 20, max: 100)
```

---

## 12. Glossary

| Term | Definition |
|------|------------|
| MTProto | Telegram's custom protocol for API communication |
| GramJS | Node.js implementation of MTProto |
| Telethon | Python implementation of MTProto (future migration) |
| FSD | Feature-Sliced Design - frontend architecture methodology |
| BullMQ | Redis-based job queue for Node.js |
| FloodWait | Telegram's rate limit response requiring wait before retry |
| tsvector | PostgreSQL data type for full-text search |
| file_id | Telegram's reference to a file, used for fetching media |
