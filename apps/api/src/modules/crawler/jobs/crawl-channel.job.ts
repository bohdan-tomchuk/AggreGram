import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramService } from '../telegram.service';
import { Channel } from '../../../database/entities/channel.entity';
import { Post } from '../../../database/entities/post.entity';

interface CrawlChannelData {
  channelId: string;
}

interface MessageData {
  telegramPostId: string;
  textContent?: string;
  views?: number;
  forwards?: number;
  postedAt: Date;
  isEdited: boolean;
  editedAt?: Date;
}

@Processor('crawl', { concurrency: 2 })
export class CrawlChannelProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlChannelProcessor.name);

  constructor(
    private telegramService: TelegramService,
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
      const messages = (await this.telegramService.fetchMessages(
        channel.username!,
        channel.lastPostId,
        100,
      )) as (MessageData | null)[];

      this.logger.log(
        `Fetched ${messages.length} messages for channel ${channel.username}`,
      );

      // Save posts
      for (const msg of messages.filter((m): m is MessageData => m !== null)) {
        const existing = await this.postsRepository.findOne({
          where: {
            channelId: channel.id,
            telegramPostId: msg.telegramPostId,
          },
        });

        let post: Post;

        if (existing) {
          // Update if edited
          if (msg.isEdited) {
            Object.assign(existing, msg);
            await this.postsRepository.save(existing);
          }
          post = existing;
        } else {
          // Create new post
          const newPost = this.postsRepository.create({
            ...msg,
            channelId: channel.id,
          });
          post = await this.postsRepository.save(newPost);
        }
      }

      // Update channel last crawl info
      const validMessages = messages.filter(
        (m): m is MessageData => m !== null,
      );
      if (validMessages.length > 0) {
        const maxPostId = Math.max(
          ...validMessages.map((m) => parseInt(m.telegramPostId)),
        );
        channel.lastPostId = maxPostId.toString();
      }
      channel.lastCrawledAt = new Date();
      await this.channelsRepository.save(channel);

      return { messageCount: messages.length };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('FLOOD_WAIT_')) {
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
