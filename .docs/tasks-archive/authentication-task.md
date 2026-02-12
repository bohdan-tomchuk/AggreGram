# Authentication Implementation Plan

## Context

AggreGram has no auth system yet. The backend (NestJS + TypeORM) and frontend (Nuxt 4 + FSD) have boilerplate only — empty `modules/`, empty entities, no pages beyond `index.vue`. The frontend API plugin (`apps/web/src/app/plugins/api.ts`) already reads from an `auth-token` cookie and sets Bearer headers, providing a natural integration point. Six wireframe screens exist in Pencil (login, register, forgot-password — desktop + mobile variants).

**Goal:** JWT authentication with refresh token rotation, broken into 4 incremental phases.

---

## Phase 1: Backend Auth Foundation

### 1.1 Install dependencies (`apps/api`)
```
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt bcrypt cookie-parser @nestjs/throttler
pnpm add -D @types/passport-jwt @types/bcrypt @types/cookie-parser
```

### 1.2 Shared types
- **CREATE** `packages/types/src/auth.types.ts` — `LoginRequest`, `RegisterRequest`, `ForgotPasswordRequest`, `AuthResponse` (accessToken + user), `UserProfile`, `MessageResponse`
- **MODIFY** `packages/types/src/index.ts` — export auth types

### 1.3 Auth config
- **CREATE** `apps/api/src/config/auth.config.ts` — `registerAs('auth', ...)` with `jwtAccessSecret`, `jwtRefreshSecret`, `jwtAccessExpiresIn` (15m), `jwtRefreshExpiresIn` (7d), `bcryptSaltRounds` (12)
- **MODIFY** `apps/api/src/config/config.module.ts` — add `authConfig` to `load` array
- **MODIFY** `apps/api/.env` — add `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, etc.

### 1.4 User entity + module
- **CREATE** `apps/api/src/modules/users/user.entity.ts` — `users` table: `id` (uuid PK), `email` (unique), `password_hash`, `created_at`, `updated_at`
- **CREATE** `apps/api/src/modules/users/users.service.ts` — `findByEmail()`, `findById()`, `create()`
- **CREATE** `apps/api/src/modules/users/users.module.ts`

### 1.5 Refresh token entity
- **CREATE** `apps/api/src/modules/auth/refresh-token.entity.ts` — `refresh_tokens` table: `id` (uuid PK), `token_hash` (SHA-256 of raw token), `user_id` (FK), `expires_at`, `is_revoked`, `family_id` (for rotation theft detection), `created_at`

### 1.6 Database wiring + migration
- **MODIFY** `apps/api/src/database/data-source.ts` — change `entities: []` to `entities: ['src/modules/**/*.entity.ts']`
- **MODIFY** `apps/api/src/database/database.module.ts` — change `entities: []` to autoload pattern
- **GENERATE** migration via `pnpm migration:generate`

### 1.7 Common decorators
- **CREATE** `apps/api/src/common/decorators/public.decorator.ts` — `@Public()` + `IS_PUBLIC_KEY`
- **CREATE** `apps/api/src/common/decorators/current-user.decorator.ts` — `@CurrentUser()` param decorator
- **MODIFY** `apps/api/src/common/decorators/index.ts` — export both

### 1.8 Auth module
- **CREATE** `apps/api/src/modules/auth/dto/login.dto.ts` — email + password validation
- **CREATE** `apps/api/src/modules/auth/dto/register.dto.ts` — email + password + confirmPassword with custom `@Match` validator
- **CREATE** `apps/api/src/modules/auth/dto/forgot-password.dto.ts` — email only
- **CREATE** `apps/api/src/modules/auth/dto/match.decorator.ts` — custom class-validator `@Match('password')`
- **CREATE** `apps/api/src/modules/auth/strategies/jwt.strategy.ts` — extract Bearer token, validate access JWT
- **CREATE** `apps/api/src/modules/auth/strategies/local.strategy.ts` — validate email + bcrypt password
- **CREATE** `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` — global guard with `@Public()` bypass
- **CREATE** `apps/api/src/modules/auth/guards/local-auth.guard.ts`
- **CREATE** `apps/api/src/modules/auth/auth.service.ts` — core logic:
  - `register()` — hash password, create user, generate token pair
  - `login()` — generate token pair (user pre-validated by LocalStrategy)
  - `refreshTokens()` — validate token hash vs DB, check family for reuse detection, revoke old, issue new pair
  - `logout()` — revoke refresh token + clear cookie
  - `validateUser()` — find by email, bcrypt compare
  - `generateTokenPair()` — sign access JWT + refresh JWT, store refresh hash in DB with family_id
- **CREATE** `apps/api/src/modules/auth/auth.controller.ts` — endpoints:
  - `POST /auth/register` — `@Public()`, returns `AuthResponse`, sets httpOnly refresh cookie
  - `POST /auth/login` — `@Public()`, `@UseGuards(LocalAuthGuard)`, same response
  - `POST /auth/refresh` — `@Public()`, reads refresh cookie, rotates tokens
  - `POST /auth/logout` — revokes token, clears cookie
  - `POST /auth/forgot-password` — `@Public()`, placeholder (always returns success)
  - `GET /auth/me` — returns current user from JWT
- **CREATE** `apps/api/src/modules/auth/auth.module.ts` — imports UsersModule, PassportModule, JwtModule, TypeOrmModule

### 1.9 Wire up globally
- **MODIFY** `apps/api/src/app.module.ts` — import AuthModule, UsersModule, ThrottlerModule; register JwtAuthGuard + ThrottlerGuard as global APP_GUARDs
- **MODIFY** `apps/api/src/main.ts` — add `cookie-parser` middleware

### Token Strategy
- **Access token**: 15min, returned in response body, stored in `auth-token` cookie by frontend
- **Refresh token**: 7 days, set as `httpOnly`/`Secure`/`SameSite=Lax` cookie by backend
- **Rotation**: each refresh invalidates old token, issues new pair; if revoked token reused, entire family revoked (theft detection)
- **Rate limiting**: `@Throttle(5/min)` on AuthController, 100/min general

---

## Phase 2: Frontend Auth Pages (UI)

### 2.1 Auth layout
- **CREATE** `apps/web/src/layouts/auth.vue` — responsive split layout: left brand panel (desktop only, gray bg, logo + tagline) + right form panel. Mobile: single column, brand at top. Matches wireframe structure from nodes `lwxZ9`/`pLQSZ`.

### 2.2 Auth feature components
- **CREATE** `apps/web/src/features/auth/ui/LoginForm.vue` — email + password inputs (UInput), "Remember me" (UCheckbox), "Forgot password?" link, Sign In button (UButton), "Don't have an account? Sign up" link. Client validation. Emits `submit`.
- **CREATE** `apps/web/src/features/auth/ui/RegisterForm.vue` — email + password + strength bar + confirm password + terms checkbox, Create Account button, "Already have an account? Sign in". Client validation with strength indicator.
- **CREATE** `apps/web/src/features/auth/ui/ForgotPasswordForm.vue` — email input, Send Reset Link button, "Back to Sign in" link.
- **CREATE** `apps/web/src/features/auth/ui/PasswordStrengthBar.vue` — visual strength indicator (4 segments with color)
- **CREATE** `apps/web/src/features/auth/model/usePasswordStrength.ts` — composable returning strength level (0-4), label, color

### 2.3 Auth pages
- **CREATE** `apps/web/src/pages/auth/login.vue` — uses `auth` layout + `LoginForm`
- **CREATE** `apps/web/src/pages/auth/register.vue` — uses `auth` layout + `RegisterForm`
- **CREATE** `apps/web/src/pages/auth/forgot-password.vue` — uses `auth` layout + `ForgotPasswordForm`

---

## Phase 3: Frontend-Backend Integration

### 3.1 Auth API layer
- **CREATE** `apps/web/src/entities/session/api/authApi.ts` — functions calling `$api`: `login()`, `register()`, `refresh()`, `logout()`, `forgotPassword()`, `me()`

### 3.2 Auth store
- **CREATE** `apps/web/src/shared/model/stores/authStore.ts` — Pinia store:
  - State: `user`, `isAuthenticated` (computed), `loading`
  - Actions: `login()`, `register()`, `logout()`, `refreshSession()`, `fetchUser()`, `clearAuth()`
  - Writes access token to `auth-token` cookie (read by existing API plugin)
  - Schedules auto-refresh 1 minute before access token expiry (14 min timer)

### 3.3 Update API plugin
- **MODIFY** `apps/web/src/app/plugins/api.ts` — on 401, attempt silent refresh before redirecting to `/auth/login`. Add `_retry` flag to prevent infinite loops. Queue concurrent refreshes.

### 3.4 Auth initialization
- **CREATE** `apps/web/src/app/plugins/auth.ts` — on app init, if `auth-token` cookie exists, call `authStore.fetchUser()` to hydrate state (works with SSR)

### 3.5 Route middleware
- **CREATE** `apps/web/src/middleware/auth.ts` — redirect to `/auth/login` if not authenticated
- **CREATE** `apps/web/src/middleware/guest.ts` — redirect to `/` if already authenticated

### 3.6 Wire up pages
- **MODIFY** auth pages — call store actions on form submit, navigate on success, show errors via `useToast()`
- **MODIFY** `apps/web/src/pages/index.vue` — add `middleware: 'auth'`

---

## Phase 4: Polish and Hardening

### 4.1 Backend polish
- **CREATE** `apps/api/src/common/filters/http-exception.filter.ts` — standardized error response format
- **MODIFY** `apps/api/src/main.ts` — register global filter + Swagger setup (`/api/docs`)
- **MODIFY** `apps/api/src/modules/auth/auth.controller.ts` — Swagger decorators, `@SkipThrottle()` on `GET /auth/me`
- Add expired token cleanup in `auth.service.ts` (on token generation)

### 4.2 Frontend polish
- **CREATE** `apps/web/src/shared/lib/validators.ts` — `validateEmail()`, `validatePassword()` helpers
- **MODIFY** form components — inline server error display, loading states on buttons, success state for forgot-password ("Check your email" confirmation)

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth library | `@nestjs/passport` + `@nestjs/jwt` | NestJS convention, composable guards |
| Access token storage | Cookie (`auth-token`) via frontend | Existing plugin already reads it |
| Refresh token storage | httpOnly cookie set by backend | Never accessible to JS |
| Password hashing | bcrypt (12 rounds) | Industry standard |
| Refresh rotation | Family-based tracking | Detects token theft |
| Frontend state | Pinia store (auto-imported) | FSD convention, SSR compatible |
| Rate limiting | `@nestjs/throttler` 5/min on auth | Matches architecture doc |

## Critical Files

| File | Why |
|------|-----|
| `apps/api/src/modules/auth/auth.service.ts` | All security-critical logic: hashing, token gen/rotation, theft detection |
| `apps/web/src/shared/model/stores/authStore.ts` | Central auth state, auto-refresh scheduling |
| `apps/web/src/app/plugins/api.ts` | Existing file, must add 401 retry with refresh |
| `apps/api/src/modules/auth/refresh-token.entity.ts` | Family-based rotation model |
| `packages/types/src/auth.types.ts` | Shared contract between frontend/backend |

## Verification

After each phase:
- **Phase 1**: `curl` or Postman to test `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `GET /me`. Verify refresh cookie is httpOnly. Verify token rotation invalidates old tokens.
- **Phase 2**: Run `pnpm dev:web`, visit `/auth/login`, `/auth/register`, `/auth/forgot-password`. Check responsive layout (desktop split + mobile single column). Verify client-side validation.
- **Phase 3**: Full E2E: register -> auto-login -> visit protected page -> wait for refresh -> logout -> redirected to login. Verify 401 retry works.
- **Phase 4**: Hit rate limits on auth endpoints. Check Swagger at `/api/docs`. Test error states (wrong password, duplicate email, expired token).
