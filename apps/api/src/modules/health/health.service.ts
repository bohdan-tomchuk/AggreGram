import { Injectable, Logger } from '@nestjs/common';
import { TdlibService } from '../telegram/services/tdlib.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly tdlibService: TdlibService) {}

  /**
   * Get session health for a specific user.
   */
  async getSessionHealth(userId: string) {
    try {
      const isAuthorized = await this.tdlibService.isAuthorized(userId);

      if (!isAuthorized) {
        return {
          status: 'disconnected',
          userId,
          authorized: false,
          message: 'Telegram session is not active. Please reconnect.',
          timestamp: new Date().toISOString(),
        };
      }

      // Try to get Telegram user ID to verify session is working
      const telegramUserId = await this.tdlibService.getTelegramUserId(userId);

      return {
        status: 'connected',
        userId,
        authorized: true,
        telegramUserId,
        message: 'Telegram session is active and healthy.',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to check session health for user ${userId}:`, error);
      return {
        status: 'error',
        userId,
        authorized: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to verify Telegram session status.',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
