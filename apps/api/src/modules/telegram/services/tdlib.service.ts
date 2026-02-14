import {
  Injectable,
  OnModuleDestroy,
  Logger,
  BadRequestException,
  TooManyRequestsException,
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

  /**
   * Search for public Telegram channels/chats by query.
   */
  async searchPublicChats(userId: string, query: string): Promise<any[]> {
    const client = this.getClient(userId);

    try {
      const result = await client.invoke({
        _: 'searchPublicChats',
        query,
      }) as { chat_ids: number[] };

      // Get full chat info for each result
      const chats = await Promise.all(
        result.chat_ids.map(async (chatId) => {
          try {
            return await this.getChat(userId, chatId);
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
    const client = this.getClient(userId);

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
    const client = this.getClient(userId);

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
    const client = this.getClient(userId);

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
    const client = this.getClient(userId);

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
   * Add a bot as admin to a channel with posting permissions.
   */
  async addBotAsAdmin(userId: string, channelId: number, botUserId: string): Promise<void> {
    const client = this.getClient(userId);

    try {
      await client.invoke({
        _: 'setChatMemberStatus',
        chat_id: channelId,
        member_id: {
          _: 'messageSenderUser',
          user_id: parseInt(botUserId, 10),
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

      this.logger.log(`Added bot ${botUserId} as admin to channel ${channelId}`);
    } catch (error) {
      this.logger.error(`Failed to add bot as admin to channel ${channelId}:`, error);
      throw new BadRequestException('Failed to add bot as channel admin');
    }
  }

  /**
   * Get an invite link for a channel.
   */
  async getInviteLink(userId: string, channelId: number): Promise<string> {
    const client = this.getClient(userId);

    try {
      const result = await client.invoke({
        _: 'getChatInviteLink',
        chat_id: channelId,
      }) as { invite_link: string };

      return result.invite_link;
    } catch (error) {
      this.logger.error(`Failed to get invite link for channel ${channelId}:`, error);
      throw new BadRequestException('Failed to get channel invite link');
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
    const client = this.getClient(userId);

    try {
      const result = await client.invoke({
        _: 'getChatHistory',
        chat_id: chatId,
        from_message_id: fromMessageId,
        offset: -99, // Fetch messages before fromMessageId
        limit: Math.min(limit, 100),
        only_local: false,
      }) as { messages: any[] };

      return result.messages || [];
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
    fromChatId: number,
    messageId: number,
    toChatId: number,
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
          const exception = new TooManyRequestsException(
            `Rate limited. Retry after ${retryAfter} seconds`,
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
        error instanceof TooManyRequestsException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to forward message');
    }
  }

  private mapTdlibError(error: unknown): BadRequestException | TooManyRequestsException {
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
        const exception = new TooManyRequestsException(
          `Rate limited. Please wait ${seconds} seconds`,
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
