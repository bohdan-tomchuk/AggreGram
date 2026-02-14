import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Feed } from '../../feeds/entities/feed.entity';
import { FeedSource } from '../../feeds/entities/feed-source.entity';
import { AggregationJob, AggregationJobStatus } from '../../feeds/entities/aggregation-job.entity';
import { UserBot } from '../../telegram/entities/user-bot.entity';
import { TdlibService } from '../../telegram/services/tdlib.service';

@Processor('post-queue')
export class PostProcessor extends WorkerHost {
  private readonly logger = new Logger(PostProcessor.name);

  constructor(
    @InjectRepository(Feed)
    private readonly feedRepository: Repository<Feed>,
    @InjectRepository(FeedSource)
    private readonly feedSourceRepository: Repository<FeedSource>,
    @InjectRepository(AggregationJob)
    private readonly aggregationJobRepository: Repository<AggregationJob>,
    @InjectRepository(UserBot)
    private readonly userBotRepository: Repository<UserBot>,
    private readonly tdlibService: TdlibService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { feedId, userId, messages, jobId } = job.data;
    const startTime = Date.now();

    this.logger.log({
      message: 'Starting post job',
      jobId: job.id,
      feedId,
      userId,
      messagesCount: messages.length,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts || 1,
    });

    // Get aggregation job
    const aggregationJob = await this.aggregationJobRepository.findOne({
      where: { id: jobId },
    });

    if (!aggregationJob) {
      throw new Error(`Aggregation job ${jobId} not found`);
    }

    try {
      // Get feed with channel
      const feed = await this.feedRepository.findOne({
        where: { id: feedId },
        relations: ['feedChannel'],
      });

      if (!feed || !feed.feedChannel) {
        throw new Error(`Feed ${feedId} or its channel not found`);
      }

      // Get user's bot
      const userBot = await this.userBotRepository.findOne({
        where: { userId },
      });

      if (!userBot) {
        throw new Error(`Bot not found for user ${userId}`);
      }

      const feedChannelId = feed.feedChannel.telegramChannelId;
      let messagesPosted = 0;

      // Forward each message
      for (const msg of messages) {
        try {
          await this.tdlibService.forwardMessage(
            userBot.botToken,
            msg.sourceChannelId,
            msg.messageId,
            Number(feedChannelId),
          );

          messagesPosted++;

          // Get old checkpoint for logging
          const oldSource = await this.feedSourceRepository.findOne({
            where: { id: msg.sourceId },
            select: ['lastMessageId'],
          });

          // Update checkpoint (lastMessageId) for this source
          await this.feedSourceRepository.update(
            { id: msg.sourceId },
            { lastMessageId: String(msg.messageId) },
          );

          this.logger.log({
            message: 'Checkpoint updated',
            feedId,
            sourceId: msg.sourceId,
            oldCheckpoint: oldSource?.lastMessageId || '0',
            newCheckpoint: String(msg.messageId),
          });

          // Small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          this.logger.error({
            message: 'Failed to forward message',
            feedId,
            messageId: msg.messageId,
            sourceChannelId: msg.sourceChannelId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other messages
        }
      }

      // Update aggregation job
      aggregationJob.messages_posted = messagesPosted;
      aggregationJob.status = AggregationJobStatus.COMPLETED;
      aggregationJob.completed_at = new Date();
      await this.aggregationJobRepository.save(aggregationJob);

      const durationMs = Date.now() - startTime;
      this.logger.log({
        message: 'Post job completed',
        jobId: job.id,
        feedId,
        messagesPosted,
        messagesTotal: messages.length,
        durationMs,
      });

      return { messagesPosted };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        message: 'Post job failed',
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
