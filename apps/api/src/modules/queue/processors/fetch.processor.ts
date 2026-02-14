import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Feed } from '../../feeds/entities/feed.entity';
import { FeedSource } from '../../feeds/entities/feed-source.entity';
import { AggregationJob, AggregationJobStatus } from '../../feeds/entities/aggregation-job.entity';
import { TdlibService } from '../../telegram/services/tdlib.service';
import { QueueService } from '../queue.service';

@Processor('fetch-queue')
export class FetchProcessor extends WorkerHost {
  private readonly logger = new Logger(FetchProcessor.name);

  constructor(
    @InjectRepository(Feed)
    private readonly feedRepository: Repository<Feed>,
    @InjectRepository(FeedSource)
    private readonly feedSourceRepository: Repository<FeedSource>,
    @InjectRepository(AggregationJob)
    private readonly aggregationJobRepository: Repository<AggregationJob>,
    private readonly tdlibService: TdlibService,
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { feedId, userId, jobId } = job.data;
    const startTime = Date.now();

    this.logger.log({
      message: 'Starting fetch job',
      jobId: job.id,
      feedId,
      userId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts || 1,
    });

    // Get or create aggregation job
    let aggregationJob: AggregationJob;
    if (jobId) {
      const existingJob = await this.aggregationJobRepository.findOne({
        where: { id: jobId },
      });
      if (!existingJob) {
        this.logger.error(`Aggregation job ${jobId} not found`);
        throw new Error('Aggregation job not found');
      }
      aggregationJob = existingJob;
    } else {
      aggregationJob = this.aggregationJobRepository.create({
        feed_id: feedId,
        status: AggregationJobStatus.RUNNING,
        started_at: new Date(),
      });
      await this.aggregationJobRepository.save(aggregationJob);
    }

    // Update status to running
    aggregationJob.status = AggregationJobStatus.RUNNING;
    aggregationJob.started_at = new Date();
    await this.aggregationJobRepository.save(aggregationJob);

    try {
      // Get feed with sources
      const feed = await this.feedRepository.findOne({
        where: { id: feedId },
        relations: ['feedSources', 'feedSources.sourceChannel', 'feedChannel'],
      });

      if (!feed) {
        throw new Error(`Feed ${feedId} not found`);
      }

      if (!feed.feedChannel) {
        throw new Error(`Feed ${feedId} has no channel`);
      }

      if (!feed.feedSources || feed.feedSources.length === 0) {
        this.logger.warn(`Feed ${feedId} has no sources, skipping fetch`);
        aggregationJob.status = AggregationJobStatus.COMPLETED;
        aggregationJob.completed_at = new Date();
        await this.aggregationJobRepository.save(aggregationJob);
        return;
      }

      const messagesToForward: Array<{
        sourceChannelId: number;
        messageId: number;
        sourceId: string;
      }> = [];

      // Fetch messages from each source
      for (const source of feed.feedSources) {
        try {
          const sourceChannelId = source.sourceChannel.telegramChannelId;
          const lastMessageId = source.lastMessageId ? Number(source.lastMessageId) : 0;

          this.logger.log({
            message: 'Fetching messages from source',
            feedId,
            sourceId: source.id,
            sourceChannelId,
            lastMessageId,
          });

          const messages = await this.tdlibService.getChatHistory(
            userId,
            Number(sourceChannelId),
            lastMessageId,
            100,
          );

          // Filter and collect messages
          const validMessages = messages.filter((msg) => {
            // Skip deleted messages, service messages, etc.
            if (!msg || msg._ === 'messageDeleted') return false;
            // Skip messages we've already seen
            if (lastMessageId > 0 && msg.id <= lastMessageId) return false;
            return true;
          });

          this.logger.log({
            message: 'Found new messages',
            feedId,
            sourceId: source.id,
            sourceChannelId,
            newMessages: validMessages.length,
            totalFetched: messages.length,
          });

          // Add to forward list
          for (const msg of validMessages) {
            messagesToForward.push({
              sourceChannelId: Number(sourceChannelId),
              messageId: msg.id,
              sourceId: source.id,
            });
          }
        } catch (error) {
          this.logger.error({
            message: 'Failed to fetch messages from source',
            feedId,
            sourceId: source.id,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other sources
        }
      }

      // Update aggregation job
      aggregationJob.messages_fetched = messagesToForward.length;
      await this.aggregationJobRepository.save(aggregationJob);

      // If we have messages, enqueue post job
      if (messagesToForward.length > 0) {
        this.logger.log({
          message: 'Enqueuing post job',
          feedId,
          jobId: job.id,
          messagesToForward: messagesToForward.length,
        });
        await this.queueService.enqueuePostJob(
          feedId,
          userId,
          messagesToForward,
          aggregationJob.id,
        );
      } else {
        // No messages to post, mark job as completed
        aggregationJob.status = AggregationJobStatus.COMPLETED;
        aggregationJob.completed_at = new Date();
        await this.aggregationJobRepository.save(aggregationJob);
      }

      const durationMs = Date.now() - startTime;
      this.logger.log({
        message: 'Fetch job completed',
        jobId: job.id,
        feedId,
        messagesFetched: messagesToForward.length,
        durationMs,
      });

      return { messagesFetched: messagesToForward.length };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        message: 'Fetch job failed',
        jobId: job.id,
        feedId,
        userId,
        attempt: job.attemptsMade + 1,
        error: errorMessage,
        durationMs,
      });

      // Update aggregation job with error
      aggregationJob.status = AggregationJobStatus.FAILED;
      aggregationJob.error_message = errorMessage;
      aggregationJob.completed_at = new Date();
      await this.aggregationJobRepository.save(aggregationJob);

      throw error;
    }
  }
}
