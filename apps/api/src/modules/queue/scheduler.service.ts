import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feed, FeedStatus } from '../feeds/entities/feed.entity';
import { QueueService } from './queue.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Feed)
    private readonly feedRepository: Repository<Feed>,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing feed scheduler...');

    // Find all active feeds and schedule them
    const activeFeeds = await this.feedRepository.find({
      where: { status: FeedStatus.ACTIVE },
      relations: ['user'],
    });

    this.logger.log(`Found ${activeFeeds.length} active feeds to schedule`);

    for (const feed of activeFeeds) {
      try {
        await this.scheduleFeed(feed.id, feed.userId, feed.pollingIntervalSec);
      } catch (error) {
        this.logger.error(
          `Failed to schedule feed ${feed.id}:`,
          error,
        );
      }
    }

    this.logger.log('Feed scheduler initialized');
  }

  /**
   * Schedule a feed for recurring message fetching.
   */
  async scheduleFeed(feedId: string, userId: string, intervalSec: number) {
    const intervalMs = intervalSec * 1000;

    try {
      const fetchQueue = this.queueService.getFetchQueue();

      // Add a repeatable job
      await fetchQueue.add(
        'fetch-feed-sources',
        { feedId, userId },
        {
          repeat: {
            every: intervalMs,
          },
          jobId: `recurring-fetch-${feedId}`,
        },
      );

      this.logger.log(
        `Scheduled feed ${feedId} for polling every ${intervalSec}s`,
      );
    } catch (error) {
      this.logger.error(`Failed to schedule feed ${feedId}:`, error);
      throw error;
    }
  }

  /**
   * Unschedule a feed (remove recurring job).
   */
  async unscheduleFeed(feedId: string) {
    try {
      const fetchQueue = this.queueService.getFetchQueue();

      // Remove repeatable job by key
      await fetchQueue.removeRepeatable('fetch-feed-sources', {
        every: 0, // Pattern doesn't matter for removal by jobId
      }, `recurring-fetch-${feedId}`);

      this.logger.log(`Unscheduled feed ${feedId}`);
    } catch (error) {
      // Job might not exist, which is fine
      this.logger.debug(`Failed to unschedule feed ${feedId}:`, error.message);
    }
  }

  /**
   * Reschedule a feed with a new interval.
   */
  async rescheduleFeed(feedId: string, userId: string, newIntervalSec: number) {
    await this.unscheduleFeed(feedId);
    await this.scheduleFeed(feedId, userId, newIntervalSec);
  }
}
