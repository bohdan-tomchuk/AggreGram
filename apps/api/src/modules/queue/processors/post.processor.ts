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

      // Group consecutive messages that belong to the same media album.
      // Albums share the same mediaAlbumId and same sourceChannelId.
      type MsgItem = (typeof messages)[number];
      const batches: Array<{ albumId: string | null; items: MsgItem[] }> = [];
      for (const msg of messages) {
        const last = batches[batches.length - 1];
        if (
          msg.mediaAlbumId &&
          last &&
          last.albumId === msg.mediaAlbumId &&
          last.items[0].sourceChannelId === msg.sourceChannelId
        ) {
          last.items.push(msg);
        } else {
          batches.push({ albumId: msg.mediaAlbumId || null, items: [msg] });
        }
      }

      for (const batch of batches) {
        const isAlbum = !!batch.albumId && batch.items.length > 1;

        if (isAlbum) {
          // ── Media group (album) ──
          const firstMsg = batch.items[0];
          const lastMsg = batch.items[batch.items.length - 1];
          const botApiIds = batch.items.map((m) => Math.floor(m.messageId / 1048576));
          const firstBotApiId = botApiIds[0];
          const sourceLink = firstMsg.sourceUsername
            ? `https://t.me/${firstMsg.sourceUsername}/${firstBotApiId}`
            : `https://t.me/c/${Math.abs(firstMsg.sourceChannelId)}/${firstBotApiId}`;
          const effectiveFromChatId = firstMsg.sourceUsername
            ? firstMsg.sourceChannelId
            : firstMsg.sourceChannelId;

          this.logger.debug({
            message: 'Reposting media group',
            albumId: batch.albumId,
            sourceChannelId: firstMsg.sourceChannelId,
            botApiIds,
          });

          try {
            await this.tdlibService.repostMediaGroup(
              plainBotToken,
              effectiveFromChatId,
              botApiIds,
              feedChannelId,
              sourceLink,
              lastMsg.caption || null,
              firstMsg.sourceUsername || null,
            );

            messagesPosted += batch.items.length;

            // Update checkpoint to the last message in the album
            const oldSource = await this.feedSourceRepository.findOne({
              where: { id: lastMsg.sourceId },
              select: ['lastMessageId'],
            });
            await this.feedSourceRepository.update(
              { id: lastMsg.sourceId },
              { lastMessageId: String(lastMsg.messageId) },
            );
            this.logger.log({
              message: 'Checkpoint updated (album)',
              feedId,
              sourceId: lastMsg.sourceId,
              oldCheckpoint: oldSource?.lastMessageId || '0',
              newCheckpoint: String(lastMsg.messageId),
              albumSize: batch.items.length,
            });
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            const isFatalChannelError = errMsg.includes('chat not found');
            if (isFatalChannelError) {
              this.logger.error({ message: 'Feed channel inaccessible, aborting post job', feedId, feedChannelId, error: errMsg });
              aggregationJob.status = AggregationJobStatus.FAILED;
              aggregationJob.error_message = `Bot lost access to feed channel (${feedChannelId}). Ensure the bot is still an admin of the channel.`;
              aggregationJob.completed_at = new Date();
              await this.aggregationJobRepository.save(aggregationJob);
              return { messagesPosted };
            }
            // TDLib session fallback for albums (same pattern as single-message fallback)
            try {
              this.logger.warn({
                message: 'Bot API cannot copy media group, trying TDLib session forward',
                albumId: batch.albumId,
                sourceChannelId: firstMsg.sourceChannelId,
                error: errMsg,
              });
              const tdlibAlbumResult = await this.tdlibService.forwardMessagesViaSession(
                userId,
                firstMsg.sourceChannelId,
                batch.items.map((m) => m.messageId),
                Number(feedChannelId),
              );
              const firstAlbumFwdMsg = tdlibAlbumResult?.messages?.[0];
              if (!firstAlbumFwdMsg?.id) {
                this.logger.warn({
                  message: 'TDLib album forward returned no message ID — source attribution skipped',
                  albumId: batch.albumId,
                  sourceChannelId: firstMsg.sourceChannelId,
                  tdlibMessages: JSON.stringify(tdlibAlbumResult?.messages?.map((m: any) => m?.id)),
                });
              } else {
                try {
                  await this.tdlibService.editMessageCaptionViaSession(
                    userId,
                    Number(feedChannelId),
                    firstAlbumFwdMsg.id,
                    `\n\n— ${sourceLink}`,
                  );
                } catch {
                  await this.tdlibService.sendSourceAttributionMessage(plainBotToken, feedChannelId, sourceLink);
                }
              }
              messagesPosted += batch.items.length;
              const oldSource = await this.feedSourceRepository.findOne({
                where: { id: lastMsg.sourceId },
                select: ['lastMessageId'],
              });
              await this.feedSourceRepository.update(
                { id: lastMsg.sourceId },
                { lastMessageId: String(lastMsg.messageId) },
              );
              this.logger.log({
                message: 'Checkpoint updated (album TDLib session fallback)',
                feedId,
                sourceId: lastMsg.sourceId,
                oldCheckpoint: oldSource?.lastMessageId || '0',
                newCheckpoint: String(lastMsg.messageId),
                albumSize: batch.items.length,
              });
            } catch (tdlibError) {
              const tdlibErrMsg = tdlibError instanceof Error ? tdlibError.message : String(tdlibError);
              this.logger.error({
                message: 'TDLib session forward also failed for media group — skipping',
                albumId: batch.albumId,
                sourceChannelId: firstMsg.sourceChannelId,
                error: tdlibErrMsg,
              });
              // Advance checkpoint past the failed album to avoid infinite retry
              await this.feedSourceRepository.update(
                { id: lastMsg.sourceId },
                { lastMessageId: String(lastMsg.messageId) },
              );
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // ── Single message ──
        const msg = batch.items[0];
        // Hoist these so they are accessible in the catch block (TDLib fallback)
        const botApiMessageId = Math.floor(msg.messageId / 1048576);
        const sourceLink = msg.sourceUsername
          ? `https://t.me/${msg.sourceUsername}/${botApiMessageId}`
          : `https://t.me/c/${Math.abs(msg.sourceChannelId)}/${botApiMessageId}`;
        try {
          // TDLib channel message IDs are multiplied by 1048576 (2^20).
          // Bot API expects the real message ID. Use division (not >> which overflows 32-bit).

          // Use numeric ID — immutable; username can be reassigned to a different channel
          const fromChatId = msg.sourceChannelId;

          this.logger.debug({
            message: 'Reposting message',
            sourceChannelId: msg.sourceChannelId,
            sourceUsername: msg.sourceUsername,
            tdlibMessageId: msg.messageId,
            botApiMessageId,
            contentType: msg.contentType,
          });

          await this.tdlibService.repostMessage(
            plainBotToken,
            fromChatId,
            botApiMessageId,
            feedChannelId,
            sourceLink,
            msg.contentType || null,
            msg.text || null,
            msg.caption || null,
            msg.sourceUsername || null,
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
          const isBotApiMediaFailure =
            msg.contentType !== 'messageText' &&
            (errMsg.includes('message to copy not found') ||
              errMsg.includes('message to forward not found') ||
              errMsg.includes('message not found'));
          const isNotFound =
            errMsg.includes('message to copy not found') ||
            errMsg.includes('message to forward not found') ||
            errMsg.includes('message not found') ||
            errMsg.includes('CHAT_FORWARDS_RESTRICTED') ||
            errMsg.includes('wrong message_id_specified') ||
            errMsg.includes('message_id_invalid');

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

          // TDLib fallback: when Bot API can't access source channel media
          if (isBotApiMediaFailure) {
            try {
              this.logger.warn({
                message: 'Bot API cannot access source media, trying TDLib session forward',
                messageId: msg.messageId,
                sourceChannelId: msg.sourceChannelId,
                contentType: msg.contentType,
              });
              const tdlibResult = await this.tdlibService.forwardMessagesViaSession(
                userId,
                msg.sourceChannelId,
                [msg.messageId],
                Number(feedChannelId),
              );
              const fwdMsg = tdlibResult?.messages?.[0];
              if (!fwdMsg?.id) {
                this.logger.warn({
                  message: 'TDLib forward returned no message ID — source attribution skipped',
                  messageId: msg.messageId,
                  sourceChannelId: msg.sourceChannelId,
                  tdlibMessages: JSON.stringify(tdlibResult?.messages?.map((m: any) => m?.id)),
                });
              } else {
                try {
                  await this.tdlibService.editMessageCaptionViaSession(
                    userId,
                    Number(feedChannelId),
                    fwdMsg.id,
                    `\n\n— ${sourceLink}`,
                  );
                } catch {
                  await this.tdlibService.sendSourceAttributionMessage(plainBotToken, feedChannelId, sourceLink);
                }
              }
              messagesPosted++;
              const oldSource = await this.feedSourceRepository.findOne({
                where: { id: msg.sourceId },
                select: ['lastMessageId'],
              });
              await this.feedSourceRepository.update(
                { id: msg.sourceId },
                { lastMessageId: String(msg.messageId) },
              );
              this.logger.log({
                message: 'Checkpoint updated (TDLib session fallback)',
                feedId,
                sourceId: msg.sourceId,
                oldCheckpoint: oldSource?.lastMessageId || '0',
                newCheckpoint: String(msg.messageId),
              });
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            } catch (tdlibError) {
              const tdlibErrMsg =
                tdlibError instanceof Error ? tdlibError.message : String(tdlibError);
              const isNotFoundTdlib =
                tdlibErrMsg.includes('message not found') ||
                tdlibErrMsg.includes('MESSAGE_ID_INVALID');
              if (isNotFoundTdlib) {
                this.logger.warn({
                  message: 'Message no longer exists in source — skipping',
                  messageId: msg.messageId,
                  sourceChannelId: msg.sourceChannelId,
                });
              } else {
                this.logger.error({
                  message: 'TDLib session forward also failed — skipping message',
                  messageId: msg.messageId,
                  sourceChannelId: msg.sourceChannelId,
                  error: tdlibErrMsg,
                });
              }
            }
          }

          this.logger.warn({
            message: errMsg.includes('CHAT_FORWARDS_RESTRICTED')
              ? 'Skipping message — source channel has content protection'
              : isNotFound
                ? 'Skipping deleted/unavailable message'
                : 'Failed to repost message',
            feedId,
            messageId: msg.messageId,
            sourceChannelId: msg.sourceChannelId,
            contentType: msg.contentType,
            error: errMsg,
          });

          // Advance checkpoint past deleted/unavailable messages to avoid infinite retry
          if (isNotFound || isBotApiMediaFailure) {
            await this.feedSourceRepository.update(
              { id: msg.sourceId },
              { lastMessageId: String(msg.messageId) },
            );
            this.logger.log({
              message: 'Checkpoint advanced past failed message',
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

  private async tryEditCaption(
    botToken: string,
    chatId: number | string,
    messageId: number,
    sourceLink: string,
  ): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${botToken}/editMessageCaption`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          caption: `\n\n— ${sourceLink}`,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        this.logger.error(
          `Could not edit caption on TDLib-forwarded msg ${messageId}: ${JSON.stringify(data)}`,
        );
      }
    } catch (err) {
      this.logger.error(`editMessageCaption failed for msg ${messageId}: ${err}`);
    }
  }
}
