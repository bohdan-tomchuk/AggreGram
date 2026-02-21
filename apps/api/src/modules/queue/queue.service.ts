import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private channelQueue: Queue;
  private fetchQueue: Queue;
  private postQueue: Queue;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisConfig = {
      host: this.configService.get<string>('redis.host')!,
      port: this.configService.get<number>('redis.port')!,
      password: this.configService.get<string>('redis.password'),
    };

    this.logger.log(`Connecting to Redis at ${redisConfig.host}:${redisConfig.port}`);

    this.channelQueue = new Queue('channel-queue', {
      connection: redisConfig,
    });

    this.fetchQueue = new Queue('fetch-queue', {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    this.postQueue = new Queue('post-queue', {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    });

    this.logger.log('Queue service initialized (channel, fetch, post queues)');
  }

  async onModuleDestroy() {
    await Promise.all([
      this.channelQueue.close(),
      this.fetchQueue.close(),
      this.postQueue.close(),
    ]);
    this.logger.log('Queue service destroyed');
  }

  /**
   * Enqueue a job to create a Telegram channel for a feed.
   */
  async enqueueChannelCreation(feedId: string, userId: string) {
    const job = await this.channelQueue.add(
      'create-feed-channel',
      { feedId, userId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Enqueued channel creation job ${job.id} for feed ${feedId}`);
    return job;
  }

  /**
   * Enqueue a job to fetch messages from feed sources.
   */
  async enqueueFetchJob(feedId: string, userId: string, jobId?: string) {
    const job = await this.fetchQueue.add(
      'fetch-feed-sources',
      { feedId, userId, jobId },
      {
        jobId: jobId || `fetch-${feedId}-${Date.now()}`,
      },
    );

    this.logger.log(`Enqueued fetch job ${job.id} for feed ${feedId}`);
    return job;
  }

  /**
   * Enqueue a job to post messages to feed channel.
   */
  async enqueuePostJob(
    feedId: string,
    userId: string,
    messages: Array<{ sourceChannelId: number; sourceUsername: string | null; messageId: number; sourceId: string }>,
    jobId: string,
  ) {
    const job = await this.postQueue.add(
      'post-to-feed',
      { feedId, userId, messages, jobId },
    );

    this.logger.log(`Enqueued post job ${job.id} for feed ${feedId} with ${messages.length} messages`);
    return job;
  }

  getChannelQueue(): Queue {
    return this.channelQueue;
  }

  getFetchQueue(): Queue {
    return this.fetchQueue;
  }

  getPostQueue(): Queue {
    return this.postQueue;
  }

  /**
   * Get current depth (waiting + active jobs) for all queues.
   */
  async getQueueDepths() {
    try {
      const [channelCounts, fetchCounts, postCounts] = await Promise.all([
        this.channelQueue.getJobCounts('waiting', 'active'),
        this.fetchQueue.getJobCounts('waiting', 'active'),
        this.postQueue.getJobCounts('waiting', 'active'),
      ]);

      return {
        channelQueue: channelCounts.waiting + channelCounts.active,
        fetchQueue: fetchCounts.waiting + fetchCounts.active,
        postQueue: postCounts.waiting + postCounts.active,
      };
    } catch (error) {
      this.logger.error('Failed to get queue depths:', error);
      return {
        channelQueue: -1,
        fetchQueue: -1,
        postQueue: -1,
      };
    }
  }
}
