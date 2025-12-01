import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from '../../database/entities/channel.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    @InjectQueue('crawl') private crawlQueue: Queue,
    @InjectRepository(Channel)
    private channelsRepository: Repository<Channel>,
  ) {}

  async onModuleInit() {
    // Queue initial crawl for all active channels
    await this.queueActiveChannels();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledCrawl() {
    this.logger.log('Running scheduled crawl');
    await this.queueActiveChannels();
  }

  async queueActiveChannels() {
    const channels = await this.channelsRepository.find({
      where: { isActive: true },
    });

    for (const channel of channels) {
      await this.queueChannelCrawl(channel.id);
    }

    this.logger.log(`Queued ${channels.length} channels for crawling`);
  }

  async queueChannelCrawl(channelId: string) {
    await this.crawlQueue.add(
      'crawl-channel',
      { channelId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute
        },
      },
    );
  }
}
