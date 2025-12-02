import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramService } from '../telegram.service';
import { MediaService } from '../media.service';
import { Channel } from '../../../database/entities/channel.entity';
import { Post } from '../../../database/entities/post.entity';

interface CrawlChannelData {
  channelId: string;
}

@Processor('crawl', { concurrency: 2 })
export class CrawlChannelProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlChannelProcessor.name);

  constructor(
    private telegramService: TelegramService,
    private mediaService: MediaService,
    @InjectRepository(Channel)
    private channelsRepository: Repository<Channel>,
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
  ) {
    super();
  }

  async process(job: Job<CrawlChannelData>): Promise<any> {
    const { channelId } = job.data;
    this.logger.log(`Processing crawl job for channel ${channelId}`);

    try {
      const channel = await this.channelsRepository.findOne({
        where: { id: channelId },
      });
      if (!channel || !channel.isActive) {
        this.logger.warn(`Channel ${channelId} not found or inactive`);
        return;
      }

      // If telegramId is 0, resolve channel first
      if (channel.telegramId === '0') {
        const metadata = await this.telegramService.resolveChannel(
          channel.username!,
        );
        channel.telegramId = metadata.id;
        channel.title = metadata.title;
        channel.description = metadata.description;
        channel.subscriberCount = metadata.subscriberCount;
        await this.channelsRepository.save(channel);
      }

      // Fetch new messages
      const messages = await this.telegramService.fetchMessages(
        channel.username!,
        channel.lastPostId,
        100,
      );

      this.logger.log(
        `Fetched ${messages.length} messages for channel ${channel.username}`,
      );

      // Save posts
      for (const msg of messages.filter((m) => m !== null)) {
        const existing = await this.postsRepository.findOne({
          where: {
            channelId: channel.id,
            telegramPostId: msg.telegramPostId,
          },
        });

        if (existing) {
          // Update if edited
          if (msg.isEdited) {
            Object.assign(existing, msg);
            await this.postsRepository.save(existing);
          }
        } else {
          // Create new post
          const post = this.postsRepository.create({
            ...msg,
            channelId: channel.id,
          });
          await this.postsRepository.save(post);

          // Generate thumbnail for photo posts
          if (msg.hasMedia && msg.mediaType === 'photo' && msg.mediaFileId) {
            try {
              const buffer = await this.telegramService.downloadMedia(
                msg.mediaFileId,
                'photo',
              );
              const thumbnailUrl = await this.mediaService.generateThumbnail(
                buffer,
                msg.mediaFileId,
              );
              post.mediaThumbnail = thumbnailUrl;
              await this.postsRepository.save(post);
            } catch (error) {
              this.logger.warn(
                `Failed to generate thumbnail for post ${post.id}`,
                error,
              );
            }
          }
        }
      }

      // Update channel last crawl info
      if (messages.length > 0) {
        const maxPostId = Math.max(
          ...messages.map((m) => parseInt(m.telegramPostId)),
        );
        channel.lastPostId = maxPostId.toString();
      }
      channel.lastCrawledAt = new Date();
      await this.channelsRepository.save(channel);

      return { messageCount: messages.length };
    } catch (error) {
      if (error.message?.startsWith('FLOOD_WAIT_')) {
        const waitTime = parseInt(error.message.split('_')[2]);
        this.logger.warn(`FLOOD_WAIT: Retrying in ${waitTime} seconds`);
        throw new Error(`Rate limited, retry after ${waitTime}s`);
      }
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed:`, error);
  }
}
