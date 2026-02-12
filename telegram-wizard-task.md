# Telegram Connection Wizard — Implementation Plan

## Context

AggreGram has a working auth system (JWT with refresh rotation, NestJS backend, Nuxt 4 frontend with FSD architecture). This task implements the **Telegram connection wizard** — connecting a user's Telegram account and auto-creating their bot via TDLib.

---

## Phase 1: Database Schema + Shared Types + TDLib Service Skeleton

### 1.1 Shared types

- **MODIFY** `packages/types/src/index.ts` — export new telegram types
- **CREATE** `packages/types/src/telegram.types.ts`:

```typescript
// Connection wizard state
export type TelegramAuthStep =
  | 'idle'
  | 'awaiting_qr_scan'
  | 'awaiting_phone'
  | 'awaiting_code'
  | 'awaiting_2fa'
  | 'setting_up'     // bot creation + finalization
  | 'connected'
  | 'error'

export interface TelegramConnectionStatus {
  step: TelegramAuthStep
  isConnected: boolean
  telegramUserId?: string
  phoneNumber?: string      // masked, e.g. "+1 (555) ***-4567"
  qrCodeUrl?: string        // base64 data URL or link for QR
  twoFactorHint?: string    // 2FA password hint from Telegram
  botUsername?: string
  error?: string
  // Resumption context — populated when user returns to wizard after interruption
  resumeContext?: {
    lastMethod?: 'qr' | 'phone'   // pre-select the method user chose before
    phoneNumber?: string            // masked phone to pre-fill (if phone method)
  }
}

// API request/response types
export interface InitConnectionRequest {
  method: 'qr' | 'phone'
}

export interface InitConnectionResponse {
  step: TelegramAuthStep
  qrCodeUrl?: string       // if method was 'qr'
}

export interface SubmitPhoneRequest {
  phoneNumber: string       // full international format, e.g. "+15551234567"
}

export interface SubmitPhoneResponse {
  step: 'awaiting_code'
  phoneNumberMasked: string
}

export interface SubmitCodeRequest {
  code: string              // 5-digit code
}

export interface SubmitCodeResponse {
  step: 'awaiting_2fa' | 'setting_up'
  twoFactorHint?: string   // present if step is awaiting_2fa
}

export interface Submit2FARequest {
  password: string
}

export interface Submit2FAResponse {
  step: 'setting_up'
}

export interface SetupProgressEvent {
  step: 'setting_up'
  stages: SetupStage[]
}

export interface SetupStage {
  id: string               // 'session_connected' | 'creating_bot' | 'finalizing'
  label: string
  status: 'pending' | 'in_progress' | 'completed' | 'error'
  error?: string
}

export interface SetupCompleteResponse {
  step: 'connected'
  botUsername: string
  botTelegramId: string
}

export interface TelegramConnectionInfo {
  isConnected: boolean
  telegramUserId?: string
  phoneNumberMasked?: string
  sessionStatus?: 'active' | 'expired' | 'revoked'
  botUsername?: string
  botStatus?: 'active' | 'revoked' | 'error'
  lastActivityAt?: string
}
```

### 1.2 Install TDLib dependency (backend)

- **RUN** in `apps/api/`: `pnpm add tdl tdl-tdlib-addon`
- **ADD** to `apps/api/.env.example`:
  ```
  # Telegram
  TELEGRAM_API_ID=
  TELEGRAM_API_HASH=
  TDLIB_DATABASE_DIR=./tdlib-data
  ```
- **ADD** `tdlib-data/` to root `.gitignore`
- **CREATE** `apps/api/src/config/telegram.config.ts` — `registerAs('telegram', ...)` with `apiId`, `apiHash`, `databaseDir`
- **MODIFY** `apps/api/src/config/config.module.ts` — add `telegramConfig` to `load` array

### 1.3 Database entities

- **CREATE** `apps/api/src/modules/telegram/entities/telegram-connection.entity.ts`:
  ```
  telegram_connections table:
  - id: UUID PK
  - user_id: UUID FK → users (unique — one connection per user)
  - telegram_user_id: bigint (nullable, set after auth completes)
  - phone_number: varchar (encrypted, nullable — stored for resumption context)
  - session_status: enum('active', 'expired', 'revoked') default 'active'
  - auth_step: varchar (current wizard step, for resumption)
  - last_auth_method: varchar (nullable, 'qr' | 'phone' — for UX context on resumption)
  - last_activity_at: timestamp
  - created_at: timestamp
  - updated_at: timestamp
  ```
  Note: TDLib session files live on disk at `tdlib-data/{userId}/`, NOT in this table. This entity only tracks metadata and wizard state.

- **CREATE** `apps/api/src/modules/telegram/entities/user-bot.entity.ts`:
  ```
  user_bots table:
  - id: UUID PK
  - user_id: UUID FK → users (unique — one bot per user)
  - bot_token: varchar (encrypted)
  - bot_username: varchar
  - bot_telegram_id: bigint
  - status: enum('creating', 'active', 'revoked', 'error')
  - created_at: timestamp
  - updated_at: timestamp
  ```

### 1.4 Database migration

- **MODIFY** `apps/api/src/database/data-source.ts` — add new entities to the entities array
- **MODIFY** `apps/api/src/database/database.module.ts` — add new entities
- **GENERATE** migration

### 1.5 TDLib service skeleton

- **CREATE** `apps/api/src/modules/telegram/telegram.module.ts` — imports ConfigModule, TypeOrmModule for both entities
- **CREATE** `apps/api/src/modules/telegram/services/tdlib.service.ts` — skeleton NestJS service:
  - Manages a `Map<string, TdlClient>` of per-user TDLib client instances
  - `getOrCreateClient(userId)` — returns existing client or creates new one with user-specific database directory (`tdlib-data/{userId}/`). TDLib writes its SQLite session files here — these persist across server restarts via Docker volume mount.
  - `destroyClient(userId)` — gracefully closes and removes client from the map (does NOT delete session files — those persist for reconnection)
  - `onModuleDestroy()` — close all clients on shutdown
  - Constructor reads `telegram.apiId` and `telegram.apiHash` from config
  - All actual auth methods are stubs that throw `NotImplementedException` for now
- **MODIFY** `apps/api/src/app.module.ts` — import TelegramModule

---

## Phase 2: Backend — Telegram Auth Flow (QR + Phone)

### 2.1 TDLib service — auth implementation

- **RUN** `pnpm add qrcode` and `pnpm add -D @types/qrcode` in `apps/api/` — for converting TDLib's `tg://` auth links into QR code PNG images (base64)
- **MODIFY** `apps/api/src/modules/telegram/services/tdlib.service.ts` — implement auth methods:
  - `initQrAuth(userId)` — creates TDLib client, calls `requestQrCodeAuthentication`, receives `tg://login?token=...` link from TDLib's `authorizationStateWaitOtherDeviceConfirmation`, converts to QR code PNG via `qrcode` npm, returns as base64 data URL
  - `initPhoneAuth(userId, phoneNumber)` — creates client, calls `setAuthenticationPhoneNumber`
  - `submitAuthCode(userId, code)` — calls `checkAuthenticationCode`, returns whether 2FA is needed
  - `submit2FA(userId, password)` — calls `checkAuthenticationPassword`
  - `getAuthState(userId)` — returns current authorization state of the client
  - `refreshQrCode(userId)` — requests new QR code
  - Internal: listen to TDLib `authorizationState` updates, map them to `TelegramAuthStep` enum
  - Internal: on successful authorization, extract `telegram_user_id` and store session info
  - Error handling: map TDLib errors to meaningful messages (wrong code, wrong password, flood wait, etc.)

### 2.2 Connection service

- **CREATE** `apps/api/src/modules/telegram/services/connection.service.ts` — orchestrates the wizard:
  - `initConnection(userId, method)` — creates/updates `telegram_connections` row, stores chosen method, delegates to TDLib service
  - `submitPhone(userId, phone)` — validates + delegates, stores phone number (encrypted) in DB for resumption context
  - `submitCode(userId, code)` — delegates, checks if 2FA needed
  - `submit2FA(userId, password)` — delegates, on success triggers setup phase
  - `getStatus(userId)` — returns current `TelegramConnectionStatus`. If DB shows mid-auth step but no active TDLib client exists (server restarted), returns step as 'idle' with `resumeContext: { method, phoneNumber }` so frontend can pre-fill and restart smoothly
  - `disconnect(userId)` — destroys TDLib client, updates DB status, does NOT delete TDLib session files (allows reconnect without re-auth if session is still valid)
  - Updates `telegram_connections.auth_step` at each transition for resumption context
  - Stores `last_auth_method` ('qr' | 'phone') in the connection row for UX context preservation

### 2.3 DTOs

- **CREATE** `apps/api/src/modules/telegram/dto/init-connection.dto.ts` — validates `method` as 'qr' | 'phone'
- **CREATE** `apps/api/src/modules/telegram/dto/submit-phone.dto.ts` — validates phone format
- **CREATE** `apps/api/src/modules/telegram/dto/submit-code.dto.ts` — validates 5-digit string
- **CREATE** `apps/api/src/modules/telegram/dto/submit-2fa.dto.ts` — validates non-empty password

### 2.4 Controller

- **CREATE** `apps/api/src/modules/telegram/telegram.controller.ts` — all endpoints require auth (JWT guard):
  - `POST /telegram/connect/init` — start auth (QR or phone)
  - `POST /telegram/connect/phone` — submit phone number
  - `POST /telegram/connect/code` — submit verification code
  - `POST /telegram/connect/2fa` — submit 2FA password
  - `POST /telegram/connect/qr/refresh` — request new QR code
  - `GET /telegram/connection` — get current connection status
  - `DELETE /telegram/connection` — disconnect Telegram
  - Swagger decorators on all endpoints

### 2.5 Wire up module

- **MODIFY** `apps/api/src/modules/telegram/telegram.module.ts` — register controller, connection service, tdlib service, export services

---

## Phase 3: Backend — Bot Factory + Setup Completion

### 3.1 Bot Factory service

- **CREATE** `apps/api/src/modules/telegram/services/bot-factory.service.ts`:
  - `createBot(userId)` — full BotFather automation sequence:
    1. Open chat with @BotFather via user's TDLib session
    2. Send `/newbot`
    3. Parse response, send bot display name (e.g., "AggreGram Feed")
    4. Generate username: `agrgrm_{random6}_bot`
    5. Parse response, retry with new username if taken (up to 5 retries)
    6. Extract bot token via regex: `/(\d+:[A-Za-z0-9_-]+)/`
    7. Store encrypted token in `user_bots` table
    8. Return bot username + telegram_id
  - `validateBotToken(token)` — quick `getMe` call via Bot API to confirm token works
  - Error handling: rate limits (retry with backoff), bot limit reached (20), unexpected BotFather responses

### 3.2 Setup orchestration

- **MODIFY** `apps/api/src/modules/telegram/services/connection.service.ts` — add setup flow:
  - `runSetup(userId)` — called after successful auth:
    1. Stage "session_connected" → mark complete
    2. Stage "creating_bot" → call bot factory
    3. Stage "finalizing" → validate bot, update connection status to 'connected'
  - Emits progress events through an `EventEmitter2` or simple observable pattern
  - Updates `telegram_connections.auth_step` to 'setting_up', then 'connected'
  - On failure: sets error state, allows retry

### 3.3 Setup progress endpoint

- **MODIFY** `apps/api/src/modules/telegram/telegram.controller.ts` — ensure `GET /telegram/connection` returns current setup stages (array of `SetupStage`) alongside step status, so frontend can poll every 2 seconds during setup phase

### 3.4 Encryption utility

- **CREATE** `apps/api/src/common/utils/encryption.util.ts`:
  - `encrypt(plaintext, key)` — AES-256-GCM encryption
  - `decrypt(ciphertext, key)` — AES-256-GCM decryption
  - Key sourced from env `ENCRYPTION_KEY`
- **ADD** `ENCRYPTION_KEY` to `.env.example`
- Use this utility in bot-factory for token storage and connection service for phone numbers

### 3.5 Install event emitter

- **RUN** `pnpm add @nestjs/event-emitter`
- **MODIFY** `apps/api/src/app.module.ts` — import `EventEmitterModule.forRoot()`

---

## Phase 4: Frontend — Wizard UI Components

### 4.1 Wizard feature structure

Create the following FSD structure:

```
features/
  telegram-wizard/
    ui/
      WizardStepIndicator.vue
      WizardStart.vue
      WizardQrCode.vue
      WizardPhoneEntry.vue
      WizardVerifyCode.vue
      Wizard2FA.vue
      WizardSettingUp.vue
      WizardSuccess.vue
    model/
      types.ts              # local wizard types/enums
```

### 4.2 Component specs (all components)

**WizardStepIndicator.vue**
- Props: `currentStep: number`, `totalSteps: number`, `labels: string[]`
- UI: Horizontal step bar shown at the top of every auth step (Start through 2FA). Each step is a small circle or segment connected by lines. Completed steps: filled brand color. Current step: filled brand with label. Future steps: gray outline. Shows step labels below circles (e.g. "Connect", "Verify", "Secure", "2FA"). The total number of steps adapts to the auth path — QR path has fewer steps (no phone/code steps), phone path has more. On mobile, show simplified dots without labels.

**WizardStart.vue**
- Props: none
- Emits: `select-method` with 'qr' | 'phone'
- UI: Step indicator at top (step 1). Centered card layout. Icon at top (link/chain icon). Title "Connect Your Telegram". Subtitle explaining privacy. Two radio-style option cards: "Scan QR Code (Recommended)" with QR icon + "Quick and secure" subtitle, "Phone Number" with phone icon + "Sign in with your phone number" subtitle. QR pre-selected. Primary button "Continue with QR Code" (text changes based on selection).

**WizardQrCode.vue**
- Props: `qrCodeUrl: string`, `loading: boolean`
- Emits: `refresh`, `switch-to-phone`
- UI: Step indicator at top (step 2 in QR path — final auth step before setup). Title "Scan QR Code". Instructions "Open Telegram → Settings → Devices → Link Desktop Device". QR code image in bordered container (use `<img>` with base64 data URL or placeholder). "Refresh QR code" button with refresh icon. "Use phone number instead" link in brand color.

**WizardPhoneEntry.vue**
- Props: `loading: boolean`, `error: string`
- Emits: `submit` with `{ countryCode: string, phoneNumber: string }`, `switch-to-qr`
- UI: Step indicator at top (step 2 in phone path). Title "Enter Phone Number". Subtitle "We'll send a verification code to your Telegram". Country code dropdown (USelect, default +1) + phone number input (UInput with placeholder). "Send Code" button. "Use QR code instead" link.

**WizardVerifyCode.vue**
- Props: `phoneDisplay: string`, `loading: boolean`, `error: string`
- Emits: `submit` with `{ code: string }`, `resend`, `wrong-number`
- UI: Step indicator at top (step 3 in phone path). Title "Enter Code". Subtitle "We sent a code to {phoneDisplay}". Five individual digit inputs with auto-advance focus. Active input has red/brand border. Resend countdown "Resend code in 0:45" (computed timer). "Wrong number?" link.

**Wizard2FA.vue**
- Props: `hint: string`, `loading: boolean`, `error: string`
- Emits: `submit` with `{ password: string }`
- UI: Step indicator at top (final auth step — step 3 in QR path or step 4 in phone path). Title "Two-Factor Authentication". Subtitle "Enter your Telegram 2FA password". Password input with visibility toggle (eye icon). Hint text below input "Hint: {hint}". "Verify" button. Lock/shield icon at top. Only shown if Telegram account has 2FA enabled.

**WizardSettingUp.vue**
- Props: `stages: Array<{ id: string, label: string, status: 'pending' | 'in_progress' | 'completed' | 'error' }>`
- Emits: none (view-only, auto-advances on completion)
- UI: No step indicator (this is a post-auth interstitial, not a user-driven step). Title "Setting Up Your Account". Subtitle "Please wait while we configure your bot". List of stages: completed = green checkmark, in_progress = spinning loader, pending = gray number, error = red X. No buttons.

**WizardSuccess.vue**
- Props: `botUsername: string`
- Emits: `create-feed`, `go-dashboard`
- UI: No step indicator. Large green checkmark circle. Title "You're All Set!". Subtitle "Your Telegram account is connected. Your bot @{botUsername} is ready to create personalized feeds." Bot card showing @{botUsername} with "Ready to create feeds" in green. "Create Your First Feed" primary button (teal/brand-600 bg). "Go to Dashboard" outlined button.

### 4.3 Wizard page

- **CREATE** `apps/web/src/pages/setup/telegram.vue`:
  - Uses default layout (or a new minimal `setup` layout — decide based on complexity)
  - Manages `currentStep` ref tracking wizard state
  - Computes step indicator props based on current auth path:
    - QR path: Start → QR Scan → (optional 2FA) → Setting Up → Success
    - Phone path: Start → Phone Entry → Verify Code → (optional 2FA) → Setting Up → Success
    - Step indicator is passed to each auth step component; hidden on Setting Up and Success screens
  - Renders the appropriate step component via `v-if` / dynamic component
  - All event handlers are stubs for now (just advance step for demo)
  - `middleware: 'auth'`
  - Page meta: `title: 'Connect Telegram — AggreGram'`

### 4.4 Shared UI helpers (if needed)

- **CREATE** `apps/web/src/shared/ui/CodeInput.vue` — reusable OTP-style code input (5 digits, auto-advance, paste support, backspace navigation). Used by WizardVerifyCode.

---

## Phase 5: Frontend — Backend Integration + Complete Flow

### 5.1 Telegram API layer

- **CREATE** `apps/web/src/entities/telegram/api/telegramApi.ts`:
  ```typescript
  export function telegramApi($api: typeof $fetch) {
    return {
      initConnection(method: 'qr' | 'phone') { ... },
      submitPhone(phoneNumber: string) { ... },
      submitCode(code: string) { ... },
      submit2FA(password: string) { ... },
      refreshQr() { ... },
      getConnection() { ... },
      disconnect() { ... },
    }
  }
  ```

### 5.2 Connection store

- **CREATE** `apps/web/src/entities/telegram/model/connectionStore.ts` — Pinia store:
  - State: `connection: TelegramConnectionInfo | null`, `wizardStep: TelegramAuthStep`, `loading`, `error`, `setupStages: SetupStage[]`, `qrCodeUrl`, `phoneDisplay`, `twoFactorHint`
  - Actions: `initConnection()`, `submitPhone()`, `submitCode()`, `submit2FA()`, `refreshQr()`, `fetchConnection()`, `disconnect()`, `pollSetupProgress()`, `reset()`
  - `pollSetupProgress()` — polls `GET /telegram/connection` every 2 seconds during setup phase until step becomes 'connected' or 'error'. (Simpler than SSE for initial implementation; SSE can replace later.)
  - Maps API responses to wizard step transitions
  - Error handling: parses backend errors, exposes user-friendly messages

### 5.3 Wire up wizard page

- **MODIFY** `apps/web/src/pages/setup/telegram.vue`:
  - Replace stub handlers with store actions
  - `currentStep` computed from `connectionStore.wizardStep`
  - On mount: `connectionStore.fetchConnection()` to check current state:
    - If already connected → redirect to dashboard
    - If mid-auth step but TDLib client lost (backend returns step 'idle' with `resumeContext`) → show start screen with pre-selected method, or phone entry with pre-filled number
    - If setup in progress → show progress screen and start polling
    - If fresh → show start screen
  - Handle all events: method selection → init, phone submit → submitPhone, code submit → submitCode, 2FA submit → submit2FA, QR refresh → refreshQr
  - Progress step: start polling on enter, stop on leave
  - Success step: navigate to feed creation or dashboard
  - Error recovery: show error on current step, allow retry

### 5.4 Navigation guard

- **CREATE** `apps/web/src/middleware/telegram-connected.ts` — for future feed pages, redirects to `/setup/telegram` if user has no active Telegram connection
- **MODIFY** `apps/web/src/pages/index.vue` — after auth, check if Telegram is connected. If not, show a prompt/CTA to connect, or auto-redirect to wizard.

### 5.5 Polish

- QR code auto-refresh: when QR code expires (TDLib sends new auth state), auto-refresh
- Resend code timer: 45-second countdown, enable "Resend" button when expired
- Toast notifications for errors using Nuxt UI's `useToast()`
- Back navigation: phone entry → start, verify code → phone entry ("Wrong number?" link)
- Loading states on all buttons during API calls


