import {
  Injectable,
  OnModuleDestroy,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getTdjson } from 'prebuilt-tdlib';
import * as tdl from 'tdl';
import * as path from 'path';
import * as QRCode from 'qrcode';
import type { TelegramAuthStep } from '@aggregram/types';
import { TelegramConnection } from '../entities/telegram-connection.entity';

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
  private readonly restorationAttempts = new Map<
    string,
    { inProgress: boolean; lastAttempt: number }
  >();
  private readonly RESTORATION_COOLDOWN_MS = 60000; // 60 seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(TelegramConnection)
    private readonly connectionRepo: Repository<TelegramConnection>,
  ) {
    this.apiId = this.configService.get<number>('telegram.apiId')!;
    this.apiHash = this.configService.get<string>('telegram.apiHash')!;
    this.databaseDir = this.configService.get<string>('telegram.databaseDir')!;
  }

  async getClient(userId: string): Promise<tdl.Client> {
    const client = this.clients.get(userId);
    if (client) {
      return client;
    }

    // Attempt to restore session from disk
    this.logger.debug(`No client in memory for user ${userId}, attempting session restoration...`);
    const restored = await this.restoreSession(userId);
    
    if (restored) {
      const restoredClient = this.clients.get(userId);
      if (restoredClient) {
        return restoredClient;
      }
    }

    // Session restoration failed - throw 401
    const error = new HttpException(
      'Telegram session expired. Please reconnect your account.',
      HttpStatus.UNAUTHORIZED,
    );
    (error as any).requiresReauth = true;
    throw error;
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

  /**
   * Attempt to restore a TDLib session from disk.
   * Returns true if session was successfully restored and verified.
   */
  async restoreSession(userId: string): Promise<boolean> {
    // Check database-level backoff first
    const shouldRestore = await this.shouldAttemptRestoration(userId);
    if (!shouldRestore) {
      return false;
    }

    // Check if restoration already in progress (in-memory check)
    const attempt = this.restorationAttempts.get(userId);
    if (attempt?.inProgress) {
      this.logger.debug(`Restoration already in progress for user ${userId}`);
      return false;
    }

    // Check cooldown period (in-memory check)
    if (attempt) {
      const elapsed = Date.now() - attempt.lastAttempt;
      if (elapsed < this.RESTORATION_COOLDOWN_MS) {
        this.logger.debug(
          `Restoration cooldown for user ${userId}: ${
            this.RESTORATION_COOLDOWN_MS - elapsed
          }ms remaining`,
        );
        return false;
      }
    }

    // Mark restoration in progress
    this.restorationAttempts.set(userId, {
      inProgress: true,
      lastAttempt: Date.now(),
    });

    try {
      const client = this.getOrCreateClient(userId);

      const result = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          this.logger.warn(`Session restoration timed out for user ${userId}`);
          this.eventEmitter.emit('telegram.session.expired', { userId });
          resolve(false);
        }, 10000);

        const handler = async (update: any) => {
          if (update._ === 'updateAuthorizationState') {
            const state = update.authorization_state._;

            if (state === 'authorizationStateReady') {
              clearTimeout(timeout);
              client.off('update', handler);

              // Verify session works by calling getMe
              try {
                await client.invoke({ _: 'getMe' });
                this.logger.log(`Session successfully restored for user ${userId}`);
                resolve(true);
              } catch (err) {
                this.logger.warn(`Restored session failed verification for user ${userId}:`, err);
                this.eventEmitter.emit('telegram.session.expired', { userId });
                resolve(false);
              }
            } else if (
              state === 'authorizationStateWaitPhoneNumber' ||
              state === 'authorizationStateWaitOtherDeviceConfirmation' ||
              state === 'authorizationStateClosed'
            ) {
              clearTimeout(timeout);
              client.off('update', handler);
              this.logger.warn(`Session restoration failed for user ${userId}: state=${state}`);
              this.eventEmitter.emit('telegram.session.expired', { userId });
              resolve(false);
            }
          }
        };

        client.on('update', handler);
      });

      // Update attempt tracking
      this.restorationAttempts.set(userId, {
        inProgress: false,
        lastAttempt: Date.now(),
      });

      // Track restoration result in database
      await this.trackRestorationAttempt(userId, result);

      return result;
    } catch (error) {
      this.logger.error(`Error during session restoration for user ${userId}:`, error);
      this.eventEmitter.emit('telegram.session.expired', { userId });

      // Update attempt tracking on failure
      this.restorationAttempts.set(userId, {
        inProgress: false,
        lastAttempt: Date.now(),
      });

      // Track failure in database
      await this.trackRestorationAttempt(userId, false);

      return false;
    } finally {
      // Cleanup stale entries (older than 1 hour)
      this.cleanupStaleRestorationAttempts();
    }
  }

  private cleanupStaleRestorationAttempts(): void {
    const oneHourAgo = Date.now() - 3600000;
    for (const [userId, attempt] of this.restorationAttempts.entries()) {
      if (attempt.lastAttempt < oneHourAgo) {
        this.restorationAttempts.delete(userId);
      }
    }
  }

  /**
   * Check if restoration should be attempted based on exponential backoff
   */
  private async shouldAttemptRestoration(userId: string): Promise<boolean> {
    const connection = await this.connectionRepo.findOneBy({ userId });
    if (!connection || connection.sessionStatus !== 'active') {
      return false;
    }

    // Apply exponential backoff based on failure count
    if (connection.restorationFailureCount > 0) {
      const backoffMs = Math.min(
        1000 * Math.pow(2, connection.restorationFailureCount), // 2s, 4s, 8s, 16s, 32s...
        3600000, // Max 1 hour
      );

      const lastAttempt = connection.lastRestorationAttemptAt?.getTime() || 0;
      const elapsed = Date.now() - lastAttempt;

      if (elapsed < backoffMs) {
        this.logger.debug(
          `Restoration backoff for user ${userId}: ${backoffMs - elapsed}ms remaining (failure count: ${connection.restorationFailureCount})`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Track restoration attempt outcome in database
   */
  private async trackRestorationAttempt(
    userId: string,
    success: boolean,
  ): Promise<void> {
    const connection = await this.connectionRepo.findOneBy({ userId });
    if (!connection) return;

    if (success) {
      // Reset on successful restoration
      connection.restorationState = undefined;
      connection.restorationFailureCount = 0;
      connection.lastActivityAt = new Date();
      this.logger.debug(`Restoration tracking reset for user ${userId}`);
    } else {
      // Increment failure count
      connection.restorationState = 'failed';
      connection.lastRestorationAttemptAt = new Date();
      connection.restorationFailureCount =
        (connection.restorationFailureCount || 0) + 1;
      this.logger.debug(
        `Restoration failure tracked for user ${userId} (count: ${connection.restorationFailureCount})`,
      );
    }

    await this.connectionRepo.save(connection);
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
    const client = await this.getClient(userId);
    
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

  /**
   * Search for public Telegram channels/chats by query.
   */
  async searchPublicChats(userId: string, query: string): Promise<any[]> {
    const client = await this.getClient(userId);

    try {
      const result = await client.invoke({
        _: 'searchPublicChats',
        query,
      }) as { chat_ids: number[] };
      
      // Get full chat info for each result
      const chats = await Promise.all(
        result.chat_ids.map(async (chatId) => {
          try {
            const chat = await this.getChat(userId, chatId);
            
            // For supergroups/channels, fetch additional details including username
            if (chat.type?._ === 'chatTypeSupergroup') {
              const supergroupId = chat.type.supergroup_id;
              const supergroup = await client.invoke({
                _: 'getSupergroup',
                supergroup_id: supergroupId,
              }) as any;
              
              // Merge supergroup data into chat object
              return {
                ...chat,
                username: supergroup.usernames?.active_usernames?.[0] || supergroup.username,
                memberCount: supergroup.member_count,
                isChannel: supergroup.is_channel,
              };
            }
            
            return chat;
          } catch (err) {
            this.logger.warn(`Failed to get chat ${chatId}:`, err);
            return null;
          }
        })
      );

      return chats.filter((chat) => chat !== null);
    } catch (error) {
      this.logger.error(`Failed to search public chats for user ${userId}:`, error);
      throw new BadRequestException('Failed to search channels');
    }
  }

  /**
   * Get detailed information about a chat by ID.
   */
  async getChat(userId: string, chatId: number): Promise<any> {
    const client = await this.getClient(userId);

    try {
      const chat = await client.invoke({
        _: 'getChat',
        chat_id: chatId,
      });

      return chat;
    } catch (error) {
      this.logger.error(`Failed to get chat ${chatId} for user ${userId}:`, error);
      throw new BadRequestException('Failed to get channel information');
    }
  }

  /**
   * Get full information about a supergroup/channel.
   */
  async getSupergroupFullInfo(userId: string, supergroupId: number): Promise<any> {
    const client = await this.getClient(userId);

    try {
      const fullInfo = await client.invoke({
        _: 'getSupergroupFullInfo',
        supergroup_id: supergroupId,
      });

      return fullInfo;
    } catch (error) {
      this.logger.warn(`Failed to get supergroup full info ${supergroupId}:`, error);
      return null;
    }
  }

  /**
   * Get a chat by username.
   */
  async searchPublicChat(userId: string, username: string): Promise<any> {
    const client = await this.getClient(userId);

    try {
      // Remove @ if present
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

      const chat = await client.invoke({
        _: 'searchPublicChat',
        username: cleanUsername,
      });

      return chat;
    } catch (error) {
      this.logger.error(`Failed to get chat by username @${username}:`, error);
      throw new BadRequestException('Channel not found');
    }
  }

  /**
   * Create a new Telegram channel using user's session.
   */
  async createChannel(userId: string, title: string, description: string): Promise<number> {
    const client = await this.getClient(userId);

    try {
      const result = await client.invoke({
        _: 'createNewSupergroupChat',
        title,
        description,
        is_channel: true,
        for_import: false,
      }) as { id: number };

      this.logger.log(`Created channel "${title}" with ID ${result.id} for user ${userId}`);
      return result.id;
    } catch (error) {
      this.logger.error(`Failed to create channel for user ${userId}:`, error);
      throw new BadRequestException('Failed to create Telegram channel');
    }
  }

  /**
   * Add a bot as a member to a channel.
   * This must be done before promoting the bot to admin.
   */
  async addBotToChannel(userId: string, channelId: number, botUserId: string): Promise<void> {
    const client = await this.getClient(userId);
    
    try {
      await client.invoke({
        _: 'addChatMember',
        chat_id: channelId,
        user_id: parseInt(botUserId, 10),
        forward_limit: 0, // Don't forward any history
      });
      
      this.logger.log(`Added bot ${botUserId} as member to channel ${channelId}`);
    } catch (error) {
      // Ignore if already a member
      if (!error.message?.includes('USER_ALREADY_PARTICIPANT')) {
        this.logger.error(`Failed to add bot to channel ${channelId}:`, error);
        throw new BadRequestException('Failed to add bot to channel');
      }
      this.logger.debug(`Bot ${botUserId} already in channel ${channelId}`);
    }
  }

  /**
   * Add a bot as admin to a channel with posting permissions.
   * For channels, bots cannot be added as regular members - they must be directly promoted to admin.
   */
  async addBotAsAdmin(userId: string, channelId: number, botUsername: string): Promise<void> {
    const client = await this.getClient(userId);

    // Step 1: Resolve bot by username to get the actual user_id
    // This is required because TDLib needs to know about the bot before we can add it
    this.logger.log(`Resolving bot @${botUsername} for user ${userId}`);
    let botUserId: number;

    try {
      const botChat = await this.searchPublicChat(userId, botUsername);

      // Extract user_id from the bot chat
      if (botChat.type?._ === 'chatTypePrivate') {
        botUserId = botChat.type.user_id;
        this.logger.log(`Resolved bot @${botUsername} to user_id ${botUserId}`);
      } else {
        throw new BadRequestException('Invalid bot username - not a private chat');
      }
    } catch (error) {
      this.logger.error(`Failed to resolve bot @${botUsername}:`, error);
      throw new BadRequestException('Failed to find bot. Make sure the bot exists.');
    }

    // Step 2: Directly promote bot to admin (bots cannot be added as regular members in channels)
    // Use retry logic to handle race conditions
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await client.invoke({
          _: 'setChatMemberStatus',
          chat_id: channelId,
          member_id: {
            _: 'messageSenderUser',
            user_id: botUserId,
          },
          status: {
            _: 'chatMemberStatusAdministrator',
            custom_title: '',
            can_be_edited: false,
            rights: {
              _: 'chatAdministratorRights',
              can_manage_chat: true,
              can_change_info: false,
              can_post_messages: true,
              can_edit_messages: true,
              can_delete_messages: true,
              can_invite_users: false,
              can_restrict_members: false,
              can_pin_messages: false,
              can_manage_topics: false,
              can_promote_members: false,
              can_manage_video_chats: false,
              can_post_stories: false,
              can_edit_stories: false,
              can_delete_stories: false,
              is_anonymous: false,
            },
          },
        });

        this.logger.log(`Added bot @${botUsername} (${botUserId}) as admin to channel ${channelId}`);
        return; // Success!

      } catch (error) {
        lastError = error;

        // Retry on certain errors with exponential backoff
        const shouldRetry = attempt < maxRetries && (
          error.message?.includes('Member not found') ||
          error.message?.includes('Try again later') ||
          error.message?.includes('FLOOD_WAIT')
        );

        if (shouldRetry) {
          const waitTime = 1000 * Math.pow(2, attempt); // Exponential backoff: 2s, 4s
          this.logger.warn(`Retry ${attempt}/${maxRetries} for adding bot as admin. Error: ${error.message}. Waiting ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          break;
        }
      }
    }

    // All retries failed
    this.logger.error(`Failed to add bot as admin to channel ${channelId}:`, lastError);
    throw new BadRequestException('Failed to add bot as channel admin');
  }

  /**
   * Get or create an invite link for a channel.
   * For newly created channels, this generates a new primary invite link.
   */
  async getInviteLink(userId: string, channelId: number): Promise<string> {
    const client = await this.getClient(userId);

    try {
      // First try to get existing primary invite link
      const existingLink = await client.invoke({
        _: 'getChatInviteLink',
        chat_id: channelId,
      }) as { invite_link: string };

      if (existingLink?.invite_link) {
        return existingLink.invite_link;
      }
    } catch (error) {
      // If no primary link exists, we'll create one below
      this.logger.debug(`No existing invite link for channel ${channelId}, creating new one`);
    }

    try {
      // Create a new primary invite link
      const result = await client.invoke({
        _: 'replacePrimaryChatInviteLink',
        chat_id: channelId,
      }) as { invite_link: string };

      this.logger.log(`Created invite link for channel ${channelId}: ${result.invite_link}`);
      return result.invite_link;
    } catch (error) {
      this.logger.error(`Failed to create invite link for channel ${channelId}:`, error);
      throw new BadRequestException('Failed to create channel invite link');
    }
  }

  /**
   * Get chat history (messages) from a channel.
   * @param userId User ID
   * @param chatId Telegram chat ID
   * @param fromMessageId Starting message ID (0 for latest messages)
   * @param limit Number of messages to fetch (max 100)
   */
  async getChatHistory(
    userId: string,
    chatId: number,
    fromMessageId: number = 0,
    limit: number = 100,
  ): Promise<any[]> {
    const client = await this.getClient(userId);

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 800;
    const offset = fromMessageId === 0 ? 0 : -(limit - 1);

    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const result = await client.invoke({
          _: 'getChatHistory',
          chat_id: chatId,
          from_message_id: fromMessageId,
          offset,
          limit: Math.min(limit, 100),
          only_local: false,
        }) as { messages: any[] };

        const messages = result.messages || [];
        if (messages.length > 0 || attempt === MAX_RETRIES - 1) {
          return messages;
        }
        // Empty result — TDLib may still be loading the chat history cache; retry
        this.logger.debug(`getChatHistory returned empty for chat ${chatId}, retry ${attempt + 1}/${MAX_RETRIES}`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
      return [];
    } catch (error) {
      this.logger.error(`Failed to get chat history for chat ${chatId}:`, error);
      throw new BadRequestException('Failed to fetch messages from channel');
    }
  }

  /**
   * Forward a message from one chat to another using Bot API.
   * @param botToken User's bot token
   * @param fromChatId Source chat ID
   * @param messageId Message ID to forward
   * @param toChatId Destination chat ID
   */
  async forwardMessage(
    botToken: string,
    fromChatId: number | string,
    messageId: number,
    toChatId: number | string,
  ): Promise<any> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/forwardMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: toChatId,
            from_chat_id: fromChatId,
            message_id: messageId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        // Handle rate limiting specifically
        if (data.error_code === 429) {
          const retryAfter = data.parameters?.retry_after || 60;
          this.logger.warn({
            message: 'Bot API rate limit hit',
            messageId,
            fromChatId,
            toChatId,
            retryAfter,
          });
          const exception = new HttpException(
            `Rate limited. Retry after ${retryAfter} seconds`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
          // Add retry-after as a custom property
          (exception as any).retryAfter = retryAfter;
          throw exception;
        }

        this.logger.error(
          `Failed to forward message ${messageId}: ${JSON.stringify(data)}`,
        );
        throw new BadRequestException(
          data.description || 'Failed to forward message',
        );
      }

      return data.result;
    } catch (error) {
      this.logger.error(
        `Failed to forward message ${messageId} from ${fromChatId} to ${toChatId}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to forward message');
    }
  }

  /**
   * Repost a message (no forwarding header) with a source attribution link.
   */
  async repostMessage(
    botToken: string,
    fromChatId: number | string,
    messageId: number,
    toChatId: number | string,
    sourceLink: string,
    contentType: string | null,
    text: string | null,
    caption: string | null,
  ): Promise<any> {
    const sourceFooter = `\n\n— <a href="${sourceLink}">Source</a>`;

    try {
      let url: string;
      let body: Record<string, unknown>;

      if (contentType === 'messageText' && text) {
        url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        body = {
          chat_id: toChatId,
          text: text + sourceFooter,
          parse_mode: 'HTML',
        };
      } else {
        url = `https://api.telegram.org/bot${botToken}/copyMessage`;
        body = {
          chat_id: toChatId,
          from_chat_id: fromChatId,
          message_id: messageId,
          caption: (caption || '') + sourceFooter,
          parse_mode: 'HTML',
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        if (data.error_code === 429) {
          const retryAfter = data.parameters?.retry_after || 60;
          this.logger.warn({
            message: 'Bot API rate limit hit',
            messageId,
            fromChatId,
            toChatId,
            retryAfter,
          });
          const exception = new HttpException(
            `Rate limited. Retry after ${retryAfter} seconds`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
          (exception as any).retryAfter = retryAfter;
          throw exception;
        }

        this.logger.error(
          `Failed to repost message ${messageId}: ${JSON.stringify(data)}`,
        );
        throw new BadRequestException(
          data.description || 'Failed to repost message',
        );
      }

      return data.result;
    } catch (error) {
      this.logger.error(
        `Failed to repost message ${messageId} from ${fromChatId} to ${toChatId}:`,
        error,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to repost message');
    }
  }

  private mapTdlibError(error: unknown): BadRequestException | HttpException {
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
        const exception = new HttpException(
          `Rate limited. Please wait ${seconds} seconds`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
        (exception as any).retryAfter = parseInt(seconds, 10);
        return exception;
      }
      if (msg.includes('SESSION_PASSWORD_NEEDED')) {
        return new BadRequestException('Two-factor authentication required');
      }

      return new BadRequestException(msg);
    }

    return new BadRequestException('An unexpected Telegram error occurred');
  }
}
