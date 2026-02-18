import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TdlibService } from '../telegram/services/tdlib.service';
import { QueueService } from '../queue/queue.service';
import { AggregationJob } from '../feeds/entities/aggregation-job.entity';
import { Feed } from '../feeds/entities/feed.entity';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly tdlibService: TdlibService,
    private readonly queueService: QueueService,
    @InjectRepository(AggregationJob)
    private readonly aggregationJobRepository: Repository<AggregationJob>,
    @InjectRepository(Feed)
    private readonly feedRepository: Repository<Feed>,
  ) {}

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

  /**
   * Get pipeline health: queue depths + recent aggregation jobs for a user.
   */
  async getPipelineHealth(userId: string) {
    const queues = await this.queueService.getQueueDepths();

    const feeds = await this.feedRepository.find({
      where: { userId },
      select: ['id'],
    });

    const feedIds = feeds.map((f) => f.id);

    let recentJobs: AggregationJob[] = [];
    if (feedIds.length > 0) {
      recentJobs = await this.aggregationJobRepository
        .createQueryBuilder('job')
        .where('job.feed_id IN (:...feedIds)', { feedIds })
        .orderBy('job.started_at', 'DESC')
        .limit(20)
        .getMany();
    }

    return {
      queues,
      recentJobs: recentJobs.map((job) => ({
        id: job.id,
        feedId: job.feed_id,
        status: job.status,
        messagesFetched: job.messages_fetched,
        messagesPosted: job.messages_posted,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        errorMessage: job.error_message,
      })),
      timestamp: new Date().toISOString(),
    };
  }
}
