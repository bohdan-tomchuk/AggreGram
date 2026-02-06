# Prompt: AggreGram Project Structure Setup

## Context

You are setting up a fresh project structure for **AggreGram** — a self-hosted Telegram channel aggregation service. This is a **complete rewrite** from a previous crawler-based architecture. The old codebase should be fully replaced.

## Architecture Overview

AggreGram uses a **"User-Owned Resources"** model:
- Each user connects their own Telegram session (via TDLib)
- Each user gets an auto-created bot (via BotFather automation)
- Feeds aggregate content from public Telegram channels into real Telegram channels (created by the user's bot)
- The web app is a **management interface only** — actual content consumption happens in Telegram

> **Scope of this task**: Set up only the bare project skeleton — frontend app, backend app, shared types package, and monorepo configuration. No database schema, no feature modules, no business logic. Those are separate tasks.

## Tech Stack (This Task Only)

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Nuxt 4, TypeScript, TailwindCSS, Nuxt UI | Latest stable |
| Backend | NestJS, TypeScript | Latest stable |
| Database | PostgreSQL 16 | Connection config only, no schema |
| ORM | TypeORM | Latest stable |
| Validation | class-validator, class-transformer | Latest stable |
| Package Manager | pnpm | Latest stable |

## Monorepo Structure

Create a **pnpm workspace monorepo** with the following structure:

```
aggregram/
├── apps/
│   ├── api/                              # NestJS Backend
│   │   ├── src/
│   │   │   ├── main.ts                   # Bootstrap with CORS, validation pipes, prefix /api
│   │   │   ├── app.module.ts             # Root module (ConfigModule, TypeOrmModule)
│   │   │   │
│   │   │   ├── config/                   # Configuration module
│   │   │   │   ├── config.module.ts
│   │   │   │   ├── app.config.ts         # App config (port, env)
│   │   │   │   └── database.config.ts    # TypeORM config (reads from env, no schema)
│   │   │   │
│   │   │   ├── common/                   # Shared utilities (empty, ready for later)
│   │   │   │   ├── decorators/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── index.ts
│   │   │   │   └── dto/
│   │   │   │       └── index.ts
│   │   │   │
│   │   │   ├── database/                 # Database setup (connection only)
│   │   │   │   ├── database.module.ts    # TypeORM module registration
│   │   │   │   ├── migrations/           # Empty, migrations added later
│   │   │   │   └── data-source.ts        # CLI data source for migrations
│   │   │   │
│   │   │   └── modules/                  # Empty, feature modules added later
│   │   │       └── .gitkeep
│   │   │
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── web/                              # Nuxt 4 Frontend (FSD Architecture)
│       ├── app/
│       │   ├── app.vue
│       │   ├── providers/
│       │   │   └── index.ts
│       │   └── styles/
│       │       └── main.css              # Tailwind imports
│       ├── pages/
│       │   └── index.vue                 # Placeholder landing page
│       ├── widgets/                      # FSD layer (empty, ready for later)
│       │   └── .gitkeep
│       ├── features/                     # FSD layer (empty, ready for later)
│       │   └── .gitkeep
│       ├── entities/                     # FSD layer (empty, ready for later)
│       │   └── .gitkeep
│       ├── shared/                       # Shared utilities
│       │   ├── api/
│       │   │   ├── instance.ts           # ofetch configured instance pointing to API
│       │   │   └── index.ts
│       │   ├── ui/
│       │   │   └── .gitkeep
│       │   ├── lib/
│       │   │   └── .gitkeep
│       │   └── config/
│       │       └── .gitkeep
│       ├── nuxt.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── .env.example
│       └── package.json
│
├── packages/
│   └── types/                            # Shared TypeScript types (empty shell)
│       ├── src/
│       │   └── index.ts                  # Type definitions, empty for now
│       ├── tsconfig.json
│       └── package.json
│
├── package.json                          # Monorepo root
├── pnpm-workspace.yaml
├── .gitignore
└── README.md
```

## Dependencies

### Root `package.json`

```json
{
  "name": "aggregram",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "dev:api": "pnpm --filter api dev",
    "dev:web": "pnpm --filter web dev",
    "build": "pnpm -r build",
    "build:api": "pnpm --filter api build",
    "build:web": "pnpm --filter web build",
    "lint": "pnpm -r lint",
    "db:migrate": "pnpm --filter api migration:run",
    "db:generate": "pnpm --filter api migration:generate",
    "clean": "pnpm -r exec rm -rf node_modules dist .nuxt .output && rm -rf node_modules"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Backend `apps/api/package.json` — Key Dependencies

**dependencies:**
- `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` — NestJS framework
- `@nestjs/config` — Environment configuration
- `@nestjs/typeorm`, `typeorm`, `pg` — Database ORM + PostgreSQL driver
- `@nestjs/swagger`, `swagger-ui-express` — API documentation
- `class-validator`, `class-transformer` — DTO validation
- `helmet` — Security headers
- `rxjs` — Required by NestJS

**devDependencies:**
- `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing`
- `typescript`, `ts-node`, `tsconfig-paths`
- `@types/node`, `@types/express`
- `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`

### Frontend `apps/web/package.json` — Key Dependencies

**dependencies:**
- `nuxt` (v4) — Framework
- `@nuxt/ui` — UI component library (includes TailwindCSS)
- `@pinia/nuxt`, `pinia` — State management
- `@vueuse/nuxt`, `@vueuse/core` — Vue composables

**devDependencies:**
- `typescript`
- `@nuxt/eslint` — ESLint integration

### Shared Types `packages/types/package.json`

**devDependencies:**
- `typescript`

## Environment Variables

### `apps/api/.env.example`

```env
# App
NODE_ENV=development
PORT=3001
API_PREFIX=api

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=aggregram
DB_PASSWORD=
DB_NAME=aggregram
```

### `apps/web/.env.example`

```env
NUXT_PUBLIC_API_BASE=http://localhost:3001/api
```

## Key Implementation Notes

1. **Nuxt 4 + FSD**: The FSD layers (`widgets/`, `features/`, `entities/`, `shared/`) must exist as empty directories with `.gitkeep` files. Only `shared/api/` should have a real file — the configured ofetch instance. Only one page: `pages/index.vue` as a minimal placeholder.

2. **CORS**: Configure for `http://localhost:3000` (Nuxt dev server) in development.

3. **TypeORM Connection**: `database.module.ts` should configure TypeORM to connect to PostgreSQL using env vars. Set `synchronize: false` and `migrations` path pointing to the migrations directory. No entities registered yet.

4. **Data Source**: `data-source.ts` should export a DataSource instance for the TypeORM CLI (`typeorm migration:*` commands).

5. **app.module.ts**: Import only `ConfigModule` (global, env file) and `DatabaseModule`. No feature modules yet.

6. **main.ts**: Set global prefix `/api`, enable CORS, enable validation pipe with `whitelist: true` and `transform: true`, apply `helmet()`.

## Task

Generate the complete project scaffolding with:
1. All configuration files (package.json for root + each app/package, tsconfig files, nest-cli.json, nuxt.config.ts, tailwind.config.ts, pnpm-workspace.yaml, .gitignore)
2. NestJS bootstrap (`main.ts`, `app.module.ts`) with CORS, validation pipe, helmet, global prefix
3. Config module reading from `.env`
4. Database module with TypeORM connection config (no entities, no migrations)
5. Data source file for TypeORM CLI
6. Empty `common/` directories with barrel `index.ts` files
7. Empty `modules/` directory with `.gitkeep`
8. Nuxt 4 app with FSD folder structure (empty layers with `.gitkeep`), Nuxt UI + TailwindCSS configured, single placeholder index page
9. `shared/api/instance.ts` with ofetch configured to point at the API base URL
10. Shared types package as an empty shell
11. Environment example files
12. README with basic setup instructions (install, dev, build)

**Do NOT implement**: Any database schema, entities, migrations, feature modules, controllers, services, DTOs, authentication, Redis, Docker, or business logic. This is purely the skeleton that compiles and runs.

**Ensure**: `pnpm build` succeeds for all packages. `pnpm dev:api` starts NestJS and connects to PostgreSQL (or logs connection error if DB not running). `pnpm dev:web` starts the Nuxt dev server with Nuxt UI working.