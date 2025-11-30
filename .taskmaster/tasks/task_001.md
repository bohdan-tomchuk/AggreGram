# Task ID: 1

**Title:** Initialize Monorepo and Configure Project Structure

**Status:** done

**Dependencies:** None

**Priority:** high

**Description:** Set up pnpm workspace monorepo with apps/web (Nuxt 4), apps/api (NestJS), and packages/types directories. Configure TypeScript, linting, and shared tooling.

**Details:**

1. Initialize pnpm workspace:
```bash
pnpm init
```

2. Create pnpm-workspace.yaml:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

3. Create directory structure:
```
telegram-crawler/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── types/
├── package.json
├── pnpm-workspace.yaml
└── .gitignore
```

4. Install root dependencies:
```bash
pnpm add -D -w typescript @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint
```

5. Create root tsconfig.json with common settings:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

6. Create packages/types/package.json:
```json
{
  "name": "@telegram-crawler/types",
  "version": "0.0.1",
  "main": "./index.ts",
  "types": "./index.ts"
}
```

7. Create shared types in packages/types/index.ts:
```typescript
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Channel {
  id: string;
  telegramId: string;
  username?: string;
  title: string;
  description?: string;
  subscriberCount?: number;
  photoUrl?: string;
  topic: string;
  channelType: 'news' | 'personal_blog' | 'official';
  isActive: boolean;
  lastCrawledAt?: Date;
  lastPostId?: string;
  crawlPriority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  channelId: string;
  telegramPostId: string;
  textContent?: string;
  hasMedia: boolean;
  mediaType?: 'photo' | 'video' | 'document';
  mediaFileId?: string;
  mediaThumbnail?: string;
  views?: number;
  forwards?: number;
  postedAt: Date;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}
```

**Test Strategy:**

1. Verify pnpm workspace configuration:
```bash
pnpm -r list
```
2. Verify TypeScript compilation:
```bash
pnpm -r exec tsc --noEmit
```
3. Check that packages/types can be imported from apps
4. Verify .gitignore excludes node_modules, dist, .env files
5. Test shared type imports work across packages
