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
import { decrypt } from '../../../common/utils/encryption.util';

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
      this.logger.debug({ message: 'Posting to feed channel', feedChannelId });
      if (Number(feedChannelId) > 0) {
        this.logger.error({
          message: 'feedChannelId is positive — may need -100 prefix!',
          feedChannelId,
        });
      }
      const plainBotToken = decrypt(userBot.botToken);
      let messagesPosted = 0;

      // Repost each message
      for (const msg of messages) {
        try {
          // TDLib channel message IDs are multiplied by 1048576 (2^20).
          // Bot API expects the real message ID. Use division (not >> which overflows 32-bit).
          const botApiMessageId = Math.floor(msg.messageId / 1048576);

          // Prefer @username for public source channels — more reliable in Bot API
          const fromChatId = msg.sourceUsername
            ? `@${msg.sourceUsername}`
            : msg.sourceChannelId;

          const sourceLink = msg.sourceUsername
            ? `https://t.me/${msg.sourceUsername}/${botApiMessageId}`
            : `https://t.me/c/${Math.abs(msg.sourceChannelId)}/${botApiMessageId}`;

          await this.tdlibService.repostMessage(
            plainBotToken,
            fromChatId as any,
            botApiMessageId,
            feedChannelId,
            sourceLink,
            msg.contentType || null,
            msg.text || null,
            msg.caption || null,
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
          const errMsg = error instanceof Error ? error.message : String(error);
          const isFatalChannelError = errMsg.includes('chat not found');
          const isNotFound =
            errMsg.includes('message to copy not found') ||
            errMsg.includes('message not found');

          if (isFatalChannelError) {
            this.logger.error({
              message: 'Feed channel inaccessible, aborting post job',
              feedId,
              feedChannelId,
              error: errMsg,
            });
            aggregationJob.status = AggregationJobStatus.FAILED;
            aggregationJob.error_message =
              `Bot lost access to feed channel (${feedChannelId}). ` +
              `Ensure the bot is still an admin of the channel.`;
            aggregationJob.completed_at = new Date();
            await this.aggregationJobRepository.save(aggregationJob);
            return { messagesPosted };
          }

          this.logger.error({
            message: isNotFound
              ? 'Skipping deleted/unavailable message'
              : 'Failed to repost message',
            feedId,
            messageId: msg.messageId,
            sourceChannelId: msg.sourceChannelId,
            error: errMsg,
          });

          // Advance checkpoint past deleted/unavailable messages to avoid infinite retry
          if (isNotFound) {
            await this.feedSourceRepository.update(
              { id: msg.sourceId },
              { lastMessageId: String(msg.messageId) },
            );
            this.logger.log({
              message: 'Checkpoint advanced past deleted message',
              feedId,
              sourceId: msg.sourceId,
              messageId: msg.messageId,
            });
          }
          // Continue with other messages
        }
      }

      // Update aggregation job
      aggregationJob.messages_posted = messagesPosted;
      if (messagesPosted === 0 && messages.length > 0) {
        aggregationJob.status = AggregationJobStatus.FAILED;
        aggregationJob.error_message =
          'All message reposts failed — check bot permissions and channel IDs';
        this.logger.error({
          message: 'Post job: all forwards failed',
          feedId,
          feedChannelId,
          messagesAttempted: messages.length,
        });
      } else {
        aggregationJob.status = AggregationJobStatus.COMPLETED;
      }
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
