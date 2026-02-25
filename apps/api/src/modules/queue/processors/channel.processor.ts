import { Processor, Worker, Job } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feed, FeedStatus } from '../../feeds/entities/feed.entity';
import { FeedChannel } from '../../feeds/entities/feed-channel.entity';
import { TdlibService } from '../../telegram/services/tdlib.service';
import { UsersService } from '../../users/users.service';
import { SchedulerService } from '../scheduler.service';
import { QueueService } from '../queue.service';

interface ChannelCreationJobData {
  feedId: string;
  userId: string;
}

@Injectable()
export class ChannelProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelProcessor.name);
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly tdlibService: TdlibService,
    private readonly usersService: UsersService,
    @InjectRepository(Feed)
    private readonly feedRepository: Repository<Feed>,
    @InjectRepository(FeedChannel)
    private readonly feedChannelRepository: Repository<FeedChannel>,
    @Inject(forwardRef(() => SchedulerService))
    private readonly schedulerService: SchedulerService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit() {
    const redisConfig = {
      host: this.configService.get<string>('redis.host')!,
      port: this.configService.get<number>('redis.port')!,
      password: this.configService.get<string>('redis.password'),
    };

    this.worker = new Worker(
      'channel-queue',
      async (job: Job<ChannelCreationJobData>) => {
        return this.processCreateFeedChannel(job);
      },
      {
        connection: redisConfig,
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed:`, err);
    });

    this.logger.log('Channel processor initialized');
  }

  async onModuleDestroy() {
    await this.worker.close();
    this.logger.log('Channel processor destroyed');
  }

  private async processCreateFeedChannel(job: Job<ChannelCreationJobData>) {
    const { feedId, userId } = job.data;
    this.logger.log(`Processing channel creation for feed ${feedId}`);

    try {
      // Get feed
      const feed = await this.feedRepository.findOne({
        where: { id: feedId, userId },
      });

      if (!feed) {
        throw new Error('Feed not found');
      }

      // Check if channel already exists
      const existingChannel = await this.feedChannelRepository.findOne({
        where: { feedId },
      });

      if (existingChannel) {
        this.logger.warn(`Channel already exists for feed ${feedId}`);
        return { channelId: existingChannel.id };
      }

      // Get user's bot
      const user = await this.usersService.findById(userId);
      if (!user?.userBot) {
        throw new Error('User bot not found. Please complete Telegram connection wizard.');
      }

      // Create Telegram channel using user's session
      this.logger.log(`Creating Telegram channel for feed: ${feed.name}`);
      const channelId = await this.tdlibService.createChannel(
        userId,
        feed.name,
        feed.description || `AggreGram feed: ${feed.name}`,
      );

      this.logger.log(`Channel created with ID: ${channelId}`);

      // Add bot as admin to the channel
      this.logger.log(`Adding bot as admin to channel ${channelId}`);
      await this.tdlibService.addBotAsAdmin(userId, channelId, user.userBot.botUsername);

      // Get invite link
      this.logger.log(`Generating invite link for channel ${channelId}`);
      const inviteLink = await this.tdlibService.getInviteLink(userId, channelId);

      // Get channel title (may have been adjusted by Telegram)
      const channelInfo = await this.tdlibService.getChat(userId, channelId);
      const title = (channelInfo as any).title || feed.name;

      // Save feed channel to database
      const feedChannel = this.feedChannelRepository.create({
        feedId: feed.id,
        telegramChannelId: String(channelId),
        inviteLink,
        title,
      });

      await this.feedChannelRepository.save(feedChannel);

      // Update feed status to active and schedule recurring sync
      feed.status = FeedStatus.ACTIVE;
      await this.feedRepository.save(feed);

      // Schedule recurring sync for this feed
      await this.schedulerService.scheduleFeed(feedId, userId, feed.pollingIntervalSec);

      // Enqueue one-time historical fetch if requested
      if (feed.fetchFromDate) {
        await this.queueService.enqueueFetchJob(feedId, userId, undefined, feed.fetchFromDate);
        this.logger.log(`Enqueued historical fetch job for feed ${feedId} (fetchFromDate: ${feed.fetchFromDate.toISOString()})`);
      }

      this.logger.log(`Channel creation completed for feed ${feedId}`);

      return {
        feedChannelId: feedChannel.id,
        telegramChannelId: channelId,
        inviteLink,
      };
    } catch (error) {
      this.logger.error(`Failed to create channel for feed ${feedId}:`, error);

      // Update feed status to error
      try {
        const feed = await this.feedRepository.findOne({
          where: { id: feedId },
        });
        if (feed) {
          feed.status = FeedStatus.ERROR;
          await this.feedRepository.save(feed);
        }
      } catch (updateError) {
        this.logger.error(`Failed to update feed status to error:`, updateError);
      }

      throw error;
    }
  }
}
