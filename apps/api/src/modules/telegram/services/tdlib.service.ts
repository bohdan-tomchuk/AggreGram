import {
  Injectable,
  OnModuleDestroy,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getTdjson } from 'prebuilt-tdlib';
import * as tdl from 'tdl';
import * as path from 'path';
import * as QRCode from 'qrcode';
import type { TelegramAuthStep } from '@aggregram/types';

// Configure tdl to use prebuilt TDLib binaries
tdl.configure({ tdjson: getTdjson() });

interface AuthContext {
  step: TelegramAuthStep;
  qrCodeUrl?: string;
  twoFactorHint?: string;
  telegramUserId?: string;
  /** Resolvers for promise-based auth flow */
  resolvePhone?: (phone: string) => void;
  resolveCode?: (code: string) => void;
  resolvePassword?: (password: string) => void;
  /** Resolve when QR code link is available */
  resolveQr?: (qrUrl: string) => void;
  /** Resolve when auth completes or reaches a user-input step */
  resolveStep?: (step: TelegramAuthStep) => void;
  rejectStep?: (error: Error) => void;
}

@Injectable()
export class TdlibService implements OnModuleDestroy {
  private readonly logger = new Logger(TdlibService.name);
  private readonly clients = new Map<string, tdl.Client>();
  private readonly authContexts = new Map<string, AuthContext>();
  private readonly apiId: number;
  private readonly apiHash: string;
  private readonly databaseDir: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.apiId = this.configService.get<number>('telegram.apiId')!;
    this.apiHash = this.configService.get<string>('telegram.apiHash')!;
    this.databaseDir = this.configService.get<string>('telegram.databaseDir')!;
  }

  getClient(userId: string): tdl.Client {
    const client = this.clients.get(userId);
    if (!client) {
      throw new BadRequestException(
        'No active Telegram session. Please authenticate first.',
      );
    }
    return client;
  }

  getOrCreateClient(userId: string): tdl.Client {
    const existing = this.clients.get(userId);
    if (existing) {
      return existing;
    }

    const databaseDirectory = path.resolve(this.databaseDir, userId);

    const client = tdl.createClient({
      apiId: this.apiId,
      apiHash: this.apiHash,
      databaseDirectory,
      tdlibParameters: {
        use_file_database: false,
        use_chat_info_database: false,
        use_message_database: false,
      },
    });

    // Add error listener for debugging
    client.on('error', (err) => {
      this.logger.error(`TDLib error for user ${userId}:`, err);
    });

    // Add update listener for debugging auth state
    client.on('update', (update) => {
      if (update._ === 'updateAuthorizationState') {
        this.logger.debug(`Auth state for user ${userId}: ${update.authorization_state._}`);
      }
    });

    this.clients.set(userId, client);
    this.logger.log(`Created TDLib client for user ${userId}`);
    return client;
  }

  async destroyClient(userId: string): Promise<void> {
    const client = this.clients.get(userId);
    if (client) {
      try {
        // Clean up QR auth listener if exists
        const qrAuthListener = (client as any).__qrAuthListener;
        if (qrAuthListener) {
          client.off('update', qrAuthListener);
          delete (client as any).__qrAuthListener;
        }
        
        await client.close();
      } catch {
        // Client may already be closed
      }
      this.clients.delete(userId);
      this.authContexts.delete(userId);
      this.logger.log(`Destroyed TDLib client for user ${userId}`);
    }
  }

  getAuthContext(userId: string): AuthContext | undefined {
    return this.authContexts.get(userId);
  }

  clearAuthContext(userId: string): void {
    this.authContexts.delete(userId);
    this.logger.debug(`Cleared auth context for user ${userId}`);
  }

  /**
   * Initialize QR code authentication. Returns a base64 data URL of the QR code.
   * Sets up a persistent listener for QR code refreshes.
   */
  async initQrAuth(userId: string): Promise<string> {
    const client = this.getOrCreateClient(userId);
    const ctx = this.ensureAuthContext(userId);

    // Set up persistent update handler for QR auth lifecycle
    this.setupQrAuthListener(userId, client, ctx);

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.logger.error(`QR code generation timed out for user ${userId}`);
        this.logger.error(`Current context step: ${ctx.step}`);
        reject(new BadRequestException('QR code generation timed out'));
      }, 30_000);

      // Store resolvers in context for the first QR code
      ctx.resolveQr = async (qrLink: string) => {
        try {
          const qrDataUrl = await QRCode.toDataURL(qrLink, {
            width: 280,
            margin: 2,
          });
          ctx.qrCodeUrl = qrDataUrl;
          ctx.step = 'awaiting_qr_scan';
          clearTimeout(timeout);
          resolve(qrDataUrl);
        } catch (err) {
          clearTimeout(timeout);
          this.logger.error(`Failed to generate QR code:`, err);
          reject(err);
        }
      };

      // Request QR code authentication from TDLib
      this.logger.debug(`Requesting QR code authentication for user ${userId}`);
      
      client.invoke({
        _: 'requestQrCodeAuthentication',
        other_user_ids: [],
      }).catch((err) => {
        clearTimeout(timeout);
        this.logger.error(`Failed to request QR authentication for user ${userId}:`, err);
        reject(new BadRequestException('Failed to initialize QR authentication'));
      });
    });
  }

  /**
   * Set up a persistent listener for QR authentication updates.
   * This handles QR code expiration, 2FA, and successful auth.
   */
  private setupQrAuthListener(
    userId: string,
    client: tdl.Client,
    ctx: AuthContext,
  ): void {
    // Remove any existing QR auth listener
    const existingListener = (client as any).__qrAuthListener;
    if (existingListener) {
      client.off('update', existingListener);
    }

    const updateHandler = async (update: any) => {
      if (update._ !== 'updateAuthorizationState') return;

      const state = update.authorization_state;
      this.logger.debug(`QR Auth state update for user ${userId}: ${state._}`);

      if (state._ === 'authorizationStateWaitOtherDeviceConfirmation') {
        // QR code is ready or has been refreshed!
        try {
          const qrLink = state.link;
          this.logger.debug(`Got QR link for user ${userId}: ${qrLink.substring(0, 50)}...`);
          
          const qrDataUrl = await QRCode.toDataURL(qrLink, {
            width: 280,
            margin: 2,
          });
          
          ctx.qrCodeUrl = qrDataUrl;
          ctx.step = 'awaiting_qr_scan';
          
          // If there's a resolver waiting (first init or manual refresh), call it
          if (ctx.resolveQr) {
            ctx.resolveQr(qrLink);
            ctx.resolveQr = undefined;
          }
          
          this.logger.log(`QR code updated for user ${userId} (expires in ~60s)`);
        } catch (err) {
          this.logger.error(`Failed to generate QR code:`, err);
        }
      } else if (state._ === 'authorizationStateWaitPassword') {
        // User scanned QR and has 2FA
        client.off('update', updateHandler);
        ctx.twoFactorHint = state.password_hint;
        ctx.step = 'awaiting_2fa';
        this.logger.debug(`2FA required after QR scan for user ${userId}`);
      } else if (state._ === 'authorizationStateReady') {
        // Successfully authenticated
        client.off('update', updateHandler);
        await this.onAuthSuccess(userId, client, ctx);
      } else if (state._ === 'authorizationStateClosed') {
        // Auth failed or client closed
        client.off('update', updateHandler);
        this.logger.debug(`Auth closed for user ${userId}`);
      }
    };

    // Store the listener so we can remove it later
    (client as any).__qrAuthListener = updateHandler;
    client.on('update', updateHandler);
  }

  /**
   * Initialize phone-based authentication.
   */
  async initPhoneAuth(userId: string, phoneNumber: string): Promise<void> {
    const client = this.getOrCreateClient(userId);
    const ctx = this.ensureAuthContext(userId);
    ctx.step = 'awaiting_code';

    client.login({
      getPhoneNumber: () => Promise.resolve(phoneNumber),
      getAuthCode: () => {
        return new Promise<string>((resolve) => {
          ctx.resolveCode = resolve;
          ctx.step = 'awaiting_code';
          if (ctx.resolveStep) ctx.resolveStep('awaiting_code');
        });
      },
      getPassword: (passwordHint) => {
        return new Promise<string>((resolve) => {
          ctx.twoFactorHint = passwordHint;
          ctx.resolvePassword = resolve;
          ctx.step = 'awaiting_2fa';
          if (ctx.resolveStep) ctx.resolveStep('awaiting_2fa');
        });
      },
    }).then(async () => {
      await this.onAuthSuccess(userId, client, ctx);
    }).catch((err) => {
      this.handleAuthError(userId, ctx, err);
    });
  }

  /**
   * Submit the verification code. Returns whether 2FA is needed.
   */
  async submitAuthCode(
    userId: string,
    code: string,
  ): Promise<{ needs2FA: boolean; hint?: string }> {
    const ctx = this.authContexts.get(userId);
    if (!ctx?.resolveCode) {
      throw new BadRequestException(
        'No pending code verification for this user',
      );
    }

    return new Promise<{ needs2FA: boolean; hint?: string }>((resolve) => {
      // When TDLib processes the code, it'll either:
      // - Ask for password (2FA) → resolveStep fires with 'awaiting_2fa'
      // - Complete auth → onAuthSuccess fires
      ctx.resolveStep = (step: TelegramAuthStep) => {
        ctx.resolveStep = undefined;
        if (step === 'awaiting_2fa') {
          resolve({ needs2FA: true, hint: ctx.twoFactorHint });
        } else if (step === 'connected' || step === 'setting_up') {
          resolve({ needs2FA: false });
        }
      };

      // Feed the code to the login flow
      ctx.resolveCode!(code);
      ctx.resolveCode = undefined;

      // If auth succeeds without 2FA, onAuthSuccess will set step
      // Give it a moment then check
      setTimeout(() => {
        if (ctx.step === 'connected' || ctx.step === 'setting_up') {
          resolve({ needs2FA: false });
        }
      }, 3000);
    });
  }

  /**
   * Submit the 2FA password.
   */
  async submit2FA(userId: string, password: string): Promise<void> {
    const ctx = this.authContexts.get(userId);
    const client = this.getClient(userId);
    
    if (!ctx || ctx.step !== 'awaiting_2fa') {
      throw new BadRequestException(
        'No pending 2FA verification for this user',
      );
    }

    // For QR auth flow (manual invoke approach)
    if (!ctx.resolvePassword) {
      return new Promise<void>((resolve, reject) => {
        // Set up a one-time update handler to monitor auth completion
        const updateHandler = async (update: any) => {
          if (update._ !== 'updateAuthorizationState') return;

          const state = update.authorization_state;
          this.logger.debug(`2FA submit state update for user ${userId}: ${state._}`);

          if (state._ === 'authorizationStateReady') {
            client.off('update', updateHandler);
            await this.onAuthSuccess(userId, client, ctx);
            resolve();
          } else if (state._ === 'authorizationStateClosed') {
            client.off('update', updateHandler);
            reject(new BadRequestException('Authentication failed'));
          }
        };

        client.on('update', updateHandler);

        // Invoke password check
        client.invoke({
          _: 'checkAuthenticationPassword',
          password,
        }).catch((err) => {
          client.off('update', updateHandler);
          this.logger.error(`2FA password check failed for user ${userId}:`, err);
          reject(new BadRequestException('Invalid 2FA password'));
        });

        // Timeout fallback
        setTimeout(() => {
          if (ctx.step === 'connected' || ctx.step === 'setting_up') {
            client.off('update', updateHandler);
            resolve();
          }
        }, 5000);
      });
    }

    // For phone auth flow (login() callback approach)
    return new Promise<void>((resolve, reject) => {
      ctx.resolveStep = (step: TelegramAuthStep) => {
        ctx.resolveStep = undefined;
        if (step === 'connected' || step === 'setting_up') {
          resolve();
        } else if (step === 'error') {
          reject(new BadRequestException(ctx.step));
        }
      };

      ctx.rejectStep = (error: Error) => {
        ctx.rejectStep = undefined;
        reject(this.mapTdlibError(error));
      };

      ctx.resolvePassword!(password);
      ctx.resolvePassword = undefined;

      // Fallback: check state after timeout
      setTimeout(() => {
        if (ctx.step === 'connected' || ctx.step === 'setting_up') {
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * Get the current auth state for a user.
   */
  async getAuthState(userId: string): Promise<TelegramAuthStep> {
    const ctx = this.authContexts.get(userId);
    if (!ctx) {
      // Check if client exists but no context (e.g., after restart)
      const client = this.clients.get(userId);
      if (!client) return 'idle';

      try {
        await client.invoke({ _: 'getMe' });
        return 'connected';
      } catch {
        return 'idle';
      }
    }
    return ctx.step;
  }

  /**
   * Request a fresh QR code for an ongoing QR auth flow.
   * The persistent listener will automatically update the QR code in the context.
   */
  async refreshQrCode(userId: string): Promise<string> {
    const client = this.clients.get(userId);
    const ctx = this.authContexts.get(userId);

    if (!client || !ctx) {
      throw new BadRequestException(
        'No active QR auth session for this user',
      );
    }

    this.logger.debug(`Manual QR code refresh requested for user ${userId}`);

    // Wait for the new QR code via the persistent listener
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new BadRequestException('QR code refresh timed out'));
      }, 15_000);

      ctx.resolveQr = async (link: string) => {
        try {
          const qrDataUrl = await QRCode.toDataURL(link, {
            width: 280,
            margin: 2,
          });
          ctx.qrCodeUrl = qrDataUrl;
          clearTimeout(timeout);
          resolve(qrDataUrl);
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      };

      // Request a new QR code from TDLib
      client.invoke({
        _: 'requestQrCodeAuthentication',
        other_user_ids: [],
      }).catch((err) => {
        clearTimeout(timeout);
        this.logger.error(`Failed to refresh QR authentication for user ${userId}:`, err);
        reject(new BadRequestException('Failed to refresh QR authentication'));
      });
    });
  }

  /**
   * Check if a user has an active, authorized TDLib client.
   */
  async isAuthorized(userId: string): Promise<boolean> {
    const client = this.clients.get(userId);
    if (!client) return false;

    try {
      await client.invoke({ _: 'getMe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the Telegram user ID for an authorized session.
   */
  async getTelegramUserId(userId: string): Promise<string | null> {
    const client = this.clients.get(userId);
    if (!client) return null;

    try {
      const me = await client.invoke({ _: 'getMe' }) as { id: number };
      return String(me.id);
    } catch {
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log(
      `Shutting down ${this.clients.size} TDLib client(s)...`,
    );
    const closePromises = Array.from(this.clients.entries()).map(
      async ([userId, client]) => {
        try {
          await client.close();
          this.logger.log(`Closed TDLib client for user ${userId}`);
        } catch (error) {
          this.logger.error(
            `Error closing TDLib client for user ${userId}`,
            error,
          );
        }
      },
    );
    await Promise.all(closePromises);
    this.clients.clear();
    this.authContexts.clear();
  }

  private ensureAuthContext(userId: string): AuthContext {
    let ctx = this.authContexts.get(userId);
    if (!ctx) {
      ctx = { step: 'idle' };
      this.authContexts.set(userId, ctx);
    }
    return ctx;
  }

  private async onAuthSuccess(
    userId: string,
    client: tdl.Client,
    ctx: AuthContext,
  ): Promise<void> {
    try {
      // Clean up QR auth listener if exists
      const qrAuthListener = (client as any).__qrAuthListener;
      if (qrAuthListener) {
        client.off('update', qrAuthListener);
        delete (client as any).__qrAuthListener;
      }
      
      const me = await client.invoke({ _: 'getMe' }) as { id: number };
      ctx.telegramUserId = String(me.id);
      ctx.step = 'setting_up';
      this.logger.log(
        `TDLib auth success for user ${userId}, telegram_id=${me.id}`,
      );
      
      // Emit event so ConnectionService can handle post-auth setup
      this.eventEmitter.emit('telegram.auth.success', {
        userId,
        telegramUserId: String(me.id),
      });
      
      if (ctx.resolveStep) {
        ctx.resolveStep('setting_up');
        ctx.resolveStep = undefined;
      }
    } catch (error) {
      this.logger.error(`Failed to get Telegram user after auth`, error);
      ctx.step = 'error';
    }
  }

  private handleAuthError(
    userId: string,
    ctx: AuthContext,
    error: unknown,
  ): void {
    // Check if this is the intentional QR auth flow rejection
    if (error instanceof Error && error.message === 'Use QR code authentication') {
      // This is expected behavior during QR auth initialization
      // The rejection triggers TDLib to call confirmOnAnotherDevice
      this.logger.debug(
        `QR authentication flow initiated for user ${userId}`,
      );
      return;
    }

    const mapped = this.mapTdlibError(error);
    this.logger.error(
      `TDLib auth error for user ${userId}: ${mapped.message}`,
    );
    ctx.step = 'error';
    if (ctx.rejectStep) {
      ctx.rejectStep(mapped);
      ctx.rejectStep = undefined;
    }
  }

  private mapTdlibError(error: unknown): BadRequestException {
    if (error instanceof Error) {
      const msg = error.message;

      if (msg.includes('PHONE_NUMBER_INVALID')) {
        return new BadRequestException('Invalid phone number format');
      }
      if (msg.includes('PHONE_CODE_INVALID') || msg.includes('PHONE_CODE_EMPTY')) {
        return new BadRequestException('Invalid verification code');
      }
      if (msg.includes('PASSWORD_HASH_INVALID')) {
        return new BadRequestException('Incorrect 2FA password');
      }
      if (msg.includes('PHONE_NUMBER_FLOOD')) {
        return new BadRequestException(
          'Too many attempts. Please try again later',
        );
      }
      if (msg.includes('FLOOD_WAIT')) {
        const seconds = msg.match(/FLOOD_WAIT_(\d+)/)?.[1] || '60';
        return new BadRequestException(
          `Rate limited. Please wait ${seconds} seconds`,
        );
      }
      if (msg.includes('SESSION_PASSWORD_NEEDED')) {
        return new BadRequestException('Two-factor authentication required');
      }

      return new BadRequestException(msg);
    }

    return new BadRequestException('An unexpected Telegram error occurred');
  }
}
