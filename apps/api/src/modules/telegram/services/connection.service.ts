import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { TelegramConnection } from '../entities/telegram-connection.entity';
import { UserBot } from '../entities/user-bot.entity';
import { TdlibService } from './tdlib.service';
import { BotFactoryService } from './bot-factory.service';
import { encrypt, decrypt } from '../../../common/utils/encryption.util';
import type {
  TelegramAuthStep,
  TelegramConnectionStatus,
  InitConnectionResponse,
  SubmitPhoneResponse,
  SubmitCodeResponse,
  Submit2FAResponse,
  TelegramConnectionInfo,
  SetupStage,
} from '@aggregram/types';

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);
  private readonly setupStages = new Map<string, SetupStage[]>();

  constructor(
    @InjectRepository(TelegramConnection)
    private readonly connectionRepo: Repository<TelegramConnection>,
    @InjectRepository(UserBot)
    private readonly botRepo: Repository<UserBot>,
    private readonly tdlibService: TdlibService,
    private readonly botFactoryService: BotFactoryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Start the connection wizard — QR or phone method.
   */
  async initConnection(
    userId: string,
    method: 'qr' | 'phone',
  ): Promise<InitConnectionResponse> {
    // Upsert connection row
    let connection = await this.connectionRepo.findOneBy({ userId });
    if (!connection) {
      connection = this.connectionRepo.create({
        userId,
        authStep: 'idle',
        lastAuthMethod: method,
      });
    } else {
      connection.lastAuthMethod = method;
      connection.authStep = 'idle';
      connection.sessionStatus = 'active';
    }
    await this.connectionRepo.save(connection);

    if (method === 'qr') {
      const qrCodeUrl = await this.tdlibService.initQrAuth(userId);
      await this.updateAuthStep(userId, 'awaiting_qr_scan');
      return { step: 'awaiting_qr_scan', qrCodeUrl };
    }

    // Phone method — just return awaiting_phone, user submits phone next
    await this.updateAuthStep(userId, 'awaiting_phone');
    return { step: 'awaiting_phone' };
  }

  /**
   * Submit phone number for phone-based auth.
   */
  async submitPhone(
    userId: string,
    phoneNumber: string,
  ): Promise<SubmitPhoneResponse> {
    const connection = await this.getConnectionOrThrow(userId);

    // Store phone number encrypted
    connection.phoneNumber = encrypt(phoneNumber);
    await this.connectionRepo.save(connection);

    await this.tdlibService.initPhoneAuth(userId, phoneNumber);
    await this.updateAuthStep(userId, 'awaiting_code');

    return {
      step: 'awaiting_code',
      phoneNumberMasked: this.maskPhoneNumber(phoneNumber),
    };
  }

  /**
   * Submit the verification code.
   */
  async submitCode(
    userId: string,
    code: string,
  ): Promise<SubmitCodeResponse> {
    await this.getConnectionOrThrow(userId);

    const result = await this.tdlibService.submitAuthCode(userId, code);

    if (result.needs2FA) {
      await this.updateAuthStep(userId, 'awaiting_2fa');
      return { step: 'awaiting_2fa', twoFactorHint: result.hint };
    }

    await this.updateAuthStep(userId, 'setting_up');
    // onAuthComplete will be called via telegram.auth.success event from TdlibService
    return { step: 'setting_up' };
  }

  /**
   * Submit the 2FA password.
   */
  async submit2FA(
    userId: string,
    password: string,
  ): Promise<Submit2FAResponse> {
    await this.getConnectionOrThrow(userId);

    await this.tdlibService.submit2FA(userId, password);
    await this.updateAuthStep(userId, 'setting_up');
    // onAuthComplete will be called via telegram.auth.success event from TdlibService

    return { step: 'setting_up' };
  }

  /**
   * Refresh the QR code during an active QR auth session.
   */
  async refreshQr(userId: string): Promise<{ qrCodeUrl: string }> {
    await this.getConnectionOrThrow(userId);
    const qrCodeUrl = await this.tdlibService.refreshQrCode(userId);
    return { qrCodeUrl };
  }

  /**
   * Get the current connection status for the wizard.
   * Includes setup stages when in the 'setting_up' phase (for frontend polling).
   */
  async getStatus(userId: string): Promise<TelegramConnectionStatus> {
    const connection = await this.connectionRepo.findOneBy({ userId });
    const bot = await this.botRepo.findOneBy({ userId });

    if (!connection) {
      return { step: 'idle', isConnected: false };
    }

    // Check if there's an active TDLib client
    const tdlibState = await this.tdlibService.getAuthState(userId);
    const authCtx = this.tdlibService.getAuthContext(userId);

    // If DB says mid-auth but no active TDLib client (server restarted),
    // return idle with resume context
    const midAuthSteps: TelegramAuthStep[] = [
      'awaiting_qr_scan',
      'awaiting_phone',
      'awaiting_code',
      'awaiting_2fa',
    ];

    if (
      midAuthSteps.includes(connection.authStep as TelegramAuthStep) &&
      tdlibState === 'idle'
    ) {
      return {
        step: 'idle',
        isConnected: false,
        resumeContext: {
          lastMethod: connection.lastAuthMethod as 'qr' | 'phone' | undefined,
          phoneNumber: connection.phoneNumber
            ? this.maskPhoneNumber(this.decryptPhoneNumber(connection.phoneNumber))
            : undefined,
        },
      };
    }

    const isConnected =
      connection.authStep === 'connected' &&
      connection.sessionStatus === 'active';

    const step = (tdlibState !== 'idle'
      ? tdlibState
      : connection.authStep) as TelegramAuthStep;

    const status: TelegramConnectionStatus = {
      step,
      isConnected,
      telegramUserId: connection.telegramUserId ?? undefined,
      phoneNumber: connection.phoneNumber
        ? this.maskPhoneNumber(this.decryptPhoneNumber(connection.phoneNumber))
        : undefined,
      qrCodeUrl: authCtx?.qrCodeUrl,
      twoFactorHint: authCtx?.twoFactorHint,
      botUsername: bot?.botUsername,
      error: authCtx?.step === 'error' ? 'Authentication failed' : undefined,
    };

    // Include setup stages when in setup or error phase
    if (step === 'setting_up' || step === 'error') {
      const stages = this.setupStages.get(userId);
      if (stages) {
        status.setupStages = stages;
      }
    }

    return status;
  }

  /**
   * Get connection info (for non-wizard contexts).
   */
  async getConnectionInfo(userId: string): Promise<TelegramConnectionInfo> {
    const connection = await this.connectionRepo.findOneBy({ userId });
    const bot = await this.botRepo.findOneBy({ userId });

    if (!connection) {
      return { isConnected: false };
    }

    return {
      isConnected:
        connection.authStep === 'connected' &&
        connection.sessionStatus === 'active',
      telegramUserId: connection.telegramUserId ?? undefined,
      phoneNumberMasked: connection.phoneNumber
        ? this.maskPhoneNumber(this.decryptPhoneNumber(connection.phoneNumber))
        : undefined,
      sessionStatus: connection.sessionStatus,
      botUsername: bot?.botUsername,
      botStatus: bot?.status === 'creating' ? undefined : bot?.status,
      lastActivityAt: connection.lastActivityAt?.toISOString(),
    };
  }

  /**
   * Disconnect Telegram — destroys client, updates DB.
   */
  async disconnect(userId: string): Promise<void> {
    await this.tdlibService.destroyClient(userId);

    const connection = await this.connectionRepo.findOneBy({ userId });
    if (connection) {
      connection.sessionStatus = 'revoked';
      connection.authStep = 'idle';
      await this.connectionRepo.save(connection);
    }

    this.setupStages.delete(userId);
    this.logger.log(`Disconnected Telegram for user ${userId}`);
  }

  /**
   * Event handler for when TDLib auth succeeds (especially for QR auth).
   * This ensures onAuthComplete is called for all auth methods.
   */
  @OnEvent('telegram.auth.success')
  async handleAuthSuccess(payload: { userId: string; telegramUserId: string }): Promise<void> {
    this.logger.debug(`Received auth success event for user ${payload.userId}`);
    await this.onAuthComplete(payload.userId);
  }

  /**
   * Called after successful TDLib authorization.
   * Updates DB with telegram user ID and kicks off setup (bot creation).
   */
  private async onAuthComplete(userId: string): Promise<void> {
    const telegramUserId =
      await this.tdlibService.getTelegramUserId(userId);

    const connection = await this.connectionRepo.findOneBy({ userId });
    if (connection) {
      connection.telegramUserId = telegramUserId;
      connection.lastActivityAt = new Date();
      connection.authStep = 'setting_up';
      await this.connectionRepo.save(connection);
    }

    this.logger.log(
      `Auth complete for user ${userId}, telegram_id=${telegramUserId}`,
    );

    // Fire and forget — setup runs in the background
    this.runSetup(userId).catch((err) => {
      this.logger.error(`Setup failed for user ${userId}`, err);
    });
  }

  /**
   * Run the post-auth setup sequence:
   * 1. session_connected  — mark TDLib session as ready
   * 2. creating_bot       — automate BotFather bot creation
   * 3. finalizing         — validate bot, mark connection as 'connected'
   */
  private async runSetup(userId: string): Promise<void> {
    const stages: SetupStage[] = [
      {
        id: 'session_connected',
        label: 'Session connected',
        status: 'completed',
      },
      {
        id: 'creating_bot',
        label: 'Creating your bot',
        status: 'pending',
      },
      {
        id: 'finalizing',
        label: 'Finalizing setup',
        status: 'pending',
      },
    ];
    this.setupStages.set(userId, stages);
    this.emitSetupProgress(userId);

    try {
      // Stage: creating_bot
      this.setStageStatus(userId, 'creating_bot', 'in_progress');
      const botResult = await this.botFactoryService.createBot(userId);
      this.setStageStatus(userId, 'creating_bot', 'completed');

      // Stage: finalizing
      this.setStageStatus(userId, 'finalizing', 'in_progress');

      // Update connection to 'connected'
      const connection = await this.connectionRepo.findOneBy({ userId });
      if (connection) {
        connection.authStep = 'connected';
        connection.sessionStatus = 'active';
        connection.lastActivityAt = new Date();
        await this.connectionRepo.save(connection);
      }

      this.setStageStatus(userId, 'finalizing', 'completed');

      // Clean up auth context in TdlibService since authentication is complete
      this.tdlibService.clearAuthContext(userId);

      this.eventEmitter.emit('telegram.setup.complete', {
        userId,
        botUsername: botResult.botUsername,
        botTelegramId: botResult.botTelegramId,
      });

      this.logger.log(
        `Setup complete for user ${userId}, bot @${botResult.botUsername}`,
      );
    } catch (error) {
      const stages = this.setupStages.get(userId);
      if (stages) {
        const inProgress = stages.find((s) => s.status === 'in_progress');
        if (inProgress) {
          inProgress.status = 'error';
          inProgress.error =
            error instanceof Error ? error.message : 'Unknown error';
        }
      }

      await this.updateAuthStep(userId, 'error');
      this.emitSetupProgress(userId);
      this.logger.error(`Setup failed for user ${userId}`, error);
    }
  }

  private setStageStatus(
    userId: string,
    stageId: string,
    status: SetupStage['status'],
    error?: string,
  ): void {
    const stages = this.setupStages.get(userId);
    if (!stages) return;

    const stage = stages.find((s) => s.id === stageId);
    if (stage) {
      stage.status = status;
      if (error) stage.error = error;
    }

    this.emitSetupProgress(userId);
  }

  private emitSetupProgress(userId: string): void {
    const stages = this.setupStages.get(userId);
    if (stages) {
      this.eventEmitter.emit('telegram.setup.progress', { userId, stages });
    }
  }

  private async updateAuthStep(
    userId: string,
    step: TelegramAuthStep,
  ): Promise<void> {
    await this.connectionRepo.update({ userId }, { authStep: step });
  }

  private async getConnectionOrThrow(
    userId: string,
  ): Promise<TelegramConnection> {
    const connection = await this.connectionRepo.findOneBy({ userId });
    if (!connection) {
      throw new BadRequestException(
        'No Telegram connection found. Start with /telegram/connect/init',
      );
    }
    return connection;
  }

  /**
   * Safely decrypt a phone number. Returns the original value if decryption
   * fails (e.g., legacy unencrypted data).
   */
  private decryptPhoneNumber(stored: string): string {
    try {
      return decrypt(stored);
    } catch {
      // Fallback for unencrypted legacy data
      return stored;
    }
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return '****';
    const visible = phone.slice(0, 4);
    const hidden = phone.slice(4, -2).replace(/\d/g, '*');
    const last = phone.slice(-2);
    return `${visible}${hidden}${last}`;
  }
}
