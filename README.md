# AggreGram

A self-hosted Telegram feed aggregation service that creates personalized feed channels by aggregating content from public Telegram channels.

## Architecture

AggreGram uses a **user-owned resources** model:
- Each user connects their own Telegram session (via TDLib)
- Each user gets an auto-created bot (via BotFather automation)
- Feeds aggregate content from public Telegram channels into real Telegram channels
- The web app is a management interface only — actual content consumption happens in Telegram

## Tech Stack

- **Frontend**: Nuxt 4, TypeScript, TailwindCSS, Nuxt UI
- **Backend**: NestJS, TypeScript
- **Database**: PostgreSQL 16
- **ORM**: TypeORM
- **Package Manager**: pnpm

## Project Structure

```
aggregram/
├── apps/
│   ├── api/          # NestJS Backend
│   └── web/          # Nuxt 4 Frontend (FSD Architecture)
├── packages/
│   └── types/        # Shared TypeScript types
├── package.json      # Monorepo root
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- PostgreSQL 16

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

**Backend** (`apps/api/.env`):
```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your database credentials
```

**Frontend** (`apps/web/.env`):
```bash
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env if needed (defaults should work for local development)
```

### 3. Set Up Database

Create a PostgreSQL database:
```bash
createdb aggregram
# Or use your preferred method
```

Update `apps/api/.env` with your database credentials.

### 4. Start Development Servers

Run all services in parallel:
```bash
pnpm dev
```

Or run services individually:
```bash
# Backend only (runs on http://localhost:3001)
pnpm dev:api

# Frontend only (runs on http://localhost:3000)
pnpm dev:web
```

The frontend will be available at http://localhost:3000 and the API at http://localhost:3001/api.

## Available Scripts

### Monorepo Root

- `pnpm dev` - Start all services in development mode
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all packages
- `pnpm clean` - Clean all node_modules and build artifacts

### Backend (`apps/api`)

- `pnpm dev:api` - Start backend in watch mode
- `pnpm build:api` - Build backend for production
- `pnpm db:migrate` - Run database migrations
- `pnpm db:generate` - Generate new migration

### Frontend (`apps/web`)

- `pnpm dev:web` - Start frontend dev server
- `pnpm build:web` - Build frontend for production

## Development

This is a bare project skeleton. The following features are not yet implemented:

- Database schema and entities
- Authentication system
- Feature modules (users, feeds, channels, etc.)
- TDLib integration
- Job queue with BullMQ
- Business logic

These will be added in subsequent tasks.

## Project Status

✅ Monorepo structure set up
✅ Backend foundation (NestJS with TypeORM connection)
✅ Frontend foundation (Nuxt 4 with FSD architecture)
✅ Shared types package structure
⏳ Database schema (upcoming)
⏳ Authentication (upcoming)
⏳ Feature modules (upcoming)
⏳ TDLib integration (upcoming)

## License

Private project - not for public distribution.
