import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Feed, FeedStatus } from '../feeds/entities/feed.entity';
import { AggregationJob, AggregationJobStatus } from '../feeds/entities/aggregation-job.entity';
import { TdlibService } from '../telegram/services/tdlib.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectRepository(Feed)
    private readonly feedRepository: Repository<Feed>,
    @InjectRepository(AggregationJob)
    private readonly aggregationJobRepository: Repository<AggregationJob>,
    private readonly tdlibService: TdlibService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Get feed health metrics.
   */
  async getFeedHealth() {
    try {
      // Get active feeds count
      const activeFeeds = await this.feedRepository.count({
        where: { status: FeedStatus.ACTIVE },
      });

      // Get total feeds by status
      const [totalFeeds, draftFeeds, pausedFeeds, errorFeeds] = await Promise.all([
        this.feedRepository.count(),
        this.feedRepository.count({ where: { status: FeedStatus.DRAFT } }),
        this.feedRepository.count({ where: { status: FeedStatus.PAUSED } }),
        this.feedRepository.count({ where: { status: FeedStatus.ERROR } }),
      ]);

      // Get recent jobs (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentJobs = await this.aggregationJobRepository.find({
        where: {
          created_at: MoreThan(oneHourAgo),
        },
        order: { created_at: 'DESC' },
      });

      // Calculate average job duration for completed jobs
      const completedJobs = recentJobs.filter(
        (job) => job.status === AggregationJobStatus.COMPLETED && job.started_at && job.completed_at,
      );

      let avgJobDurationMs = 0;
      if (completedJobs.length > 0) {
        const totalDuration = completedJobs.reduce((sum, job) => {
          const duration = job.completed_at!.getTime() - job.started_at!.getTime();
          return sum + duration;
        }, 0);
        avgJobDurationMs = Math.round(totalDuration / completedJobs.length);
      }

      // Get queue depths
      const queueDepths = await this.queueService.getQueueDepths();

      // Calculate job success rate
      const totalRecentJobs = recentJobs.length;
      const successfulJobs = recentJobs.filter((job) => job.status === AggregationJobStatus.COMPLETED).length;
      const failedJobs = recentJobs.filter((job) => job.status === AggregationJobStatus.FAILED).length;
      const successRate = totalRecentJobs > 0 ? (successfulJobs / totalRecentJobs) * 100 : 100;

      // Get message stats
      const totalMessagesFetched = recentJobs.reduce((sum, job) => sum + (job.messages_fetched || 0), 0);
      const totalMessagesPosted = recentJobs.reduce((sum, job) => sum + (job.messages_posted || 0), 0);

      return {
        status: 'healthy',
        feeds: {
          total: totalFeeds,
          active: activeFeeds,
          draft: draftFeeds,
          paused: pausedFeeds,
          error: errorFeeds,
        },
        jobs: {
          lastHour: totalRecentJobs,
          successful: successfulJobs,
          failed: failedJobs,
          successRate: Math.round(successRate),
          avgDurationMs: avgJobDurationMs,
        },
        messages: {
          fetchedLastHour: totalMessagesFetched,
          postedLastHour: totalMessagesPosted,
        },
        queues: queueDepths,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get feed health:', error);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

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
