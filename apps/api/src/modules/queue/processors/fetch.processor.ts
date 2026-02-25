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
    const { feedId, userId, jobId, fetchFromDate } = job.data;
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
        sourceUsername: string | null;
        messageId: number;
        sourceId: string;
        contentType: string | null;
        text: string | null;
        caption: string | null;
        mediaAlbumId: string | null;
        date: number;
      }> = [];
      // Track highest message ID seen per source (incl. protected) to advance checkpoints
      const checkpointAdvances = new Map<string, number>();
      let totalMessagesSeen = 0; // all new messages seen, including content-protected ones
      const sourceErrors: string[] = [];

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

          // Ensure TDLib has channel access_hash (needed after session restore)
          // Also use the chat object to check has_protected_content
          let chatHasProtection = false;
          if (source.sourceChannel.username) {
            const chat = await this.tdlibService.searchPublicChat(userId, source.sourceChannel.username);
            chatHasProtection = !!chat?.has_protected_content;
          } else {
            const chat = await this.tdlibService.getChat(userId, Number(sourceChannelId));
            chatHasProtection = !!chat?.has_protected_content;
          }

          if (chatHasProtection) {
            this.logger.warn({
              message: 'Source channel has content protection enabled, will skip posting',
              sourceChannelId,
            });
          }

          let allNewMessages: any[];

          if (fetchFromDate && lastMessageId === 0) {
            // Historical fetch: get all messages since the given date
            const sinceTimestamp = Math.floor(new Date(fetchFromDate).getTime() / 1000);
            this.logger.log({
              message: 'Fetching messages since date',
              sourceChannelId,
              fetchFromDate,
              sinceTimestamp,
            });
            allNewMessages = await this.tdlibService.getMessagesSinceDate(
              userId,
              Number(sourceChannelId),
              sinceTimestamp,
            );
          } else {
            const messages = await this.tdlibService.getChatHistory(
              userId,
              Number(sourceChannelId),
              0,
              100,
            );

            this.logger.log({
              message: 'Raw messages from TDLib',
              sourceChannelId,
              lastMessageId,
              fetchedIds: messages.map((m) => m.id).slice(0, 10),
              totalFetched: messages.length,
            });

            // Filter and collect messages (oldest first so checkpoint ends at newest)
            allNewMessages = messages
              .filter((msg) => {
                if (!msg || msg._ !== 'message') return false;
                if (lastMessageId > 0 && msg.id <= lastMessageId) return false;
                return true;
              })
              .sort((a, b) => a.id - b.id);
          }

          const messagesToUse = allNewMessages;
          totalMessagesSeen += messagesToUse.length;
          const validMessages = chatHasProtection ? [] : messagesToUse;

          this.logger.log({
            message: 'Found new messages',
            feedId,
            sourceId: source.id,
            sourceChannelId,
            newMessages: allNewMessages.length,
            forwardable: validMessages.length,
            protected: allNewMessages.length - validMessages.length,
            totalFetched: allNewMessages.length,
          });

          // Add forwardable messages to forward list
          for (const msg of validMessages) {
            messagesToForward.push({
              sourceChannelId: Number(sourceChannelId),
              sourceUsername: source.sourceChannel.username || null,
              messageId: msg.id,
              sourceId: source.id,
              contentType: msg.content?._ || null,
              text: msg.content?.text?.text || null,
              caption: msg.content?.caption?.text || null,
              // TDLib uses media_album_id (string "0" means no album)
              mediaAlbumId: msg.media_album_id && msg.media_album_id !== '0' ? msg.media_album_id : null,
              date: msg.date,
            });
          }

          // Advance checkpoint even for protected messages we can't forward
          if (allNewMessages.length > validMessages.length) {
            const highestSeen = allNewMessages[allNewMessages.length - 1]?.id;
            if (highestSeen) {
              checkpointAdvances.set(source.id, highestSeen);
            }
          }
        } catch (error) {
          const errMsg = `Source ${source.sourceChannel.username || source.id}: ${error instanceof Error ? error.message : String(error)}`;
          sourceErrors.push(errMsg);
          this.logger.error({
            message: 'Failed to fetch messages from source',
            feedId,
            sourceId: source.id,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other sources
        }
      }

      // Advance checkpoints for sources with only protected messages (no forwardable content)
      for (const [sourceId, highestId] of checkpointAdvances) {
        const alreadyCovered = messagesToForward.some(
          (m) => m.sourceId === sourceId,
        );
        if (!alreadyCovered) {
          await this.feedSourceRepository.update(
            { id: sourceId },
            { lastMessageId: String(highestId) },
          );
          this.logger.log({
            message: 'Advanced checkpoint for protected-only source',
            sourceId,
            newCheckpoint: String(highestId),
          });
        }
      }

      // Update aggregation job — messages_fetched = total seen (incl. protected),
      // so a value > 0 with messages_posted = 0 indicates content protection blocking forwards
      aggregationJob.messages_fetched = totalMessagesSeen;
      await this.aggregationJobRepository.save(aggregationJob);

      // Sort all collected messages chronologically across sources
      messagesToForward.sort((a, b) => a.date - b.date);

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
        if (messagesToForward.length === 0 && sourceErrors.length > 0) {
          aggregationJob.error_message = sourceErrors.join('; ');
        }
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
