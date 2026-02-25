import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feed, FeedStatus } from './entities/feed.entity';
import { FeedSource } from './entities/feed-source.entity';
import { FeedChannel } from './entities/feed-channel.entity';
import { SourceChannel } from './entities/source-channel.entity';
import { AggregationJob } from './entities/aggregation-job.entity';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { QueueService } from '../queue/queue.service';
import { SchedulerService } from '../queue/scheduler.service';
import { UsersService } from '../users/users.service';
import { TdlibService } from '../telegram/services/tdlib.service';
import { ChannelsService } from '../channels/channels.service';

@Injectable()
export class FeedsService {
  private readonly logger = new Logger(FeedsService.name);

  constructor(
    @InjectRepository(Feed)
    private readonly feedRepository: Repository<Feed>,
    @InjectRepository(FeedSource)
    private readonly feedSourceRepository: Repository<FeedSource>,
    @InjectRepository(FeedChannel)
    private readonly feedChannelRepository: Repository<FeedChannel>,
    @InjectRepository(SourceChannel)
    private readonly sourceChannelRepository: Repository<SourceChannel>,
    @InjectRepository(AggregationJob)
    private readonly aggregationJobRepository: Repository<AggregationJob>,
    private readonly queueService: QueueService,
    private readonly schedulerService: SchedulerService,
    private readonly usersService: UsersService,
    private readonly tdlibService: TdlibService,
    private readonly channelsService: ChannelsService,
  ) {}

  async create(userId: string, createFeedDto: CreateFeedDto): Promise<Feed> {
    const feed = this.feedRepository.create({
      userId,
      name: createFeedDto.name,
      description: createFeedDto.description || null,
      pollingIntervalSec: createFeedDto.pollingIntervalSec || 300,
      fetchFromDate: createFeedDto.fetchFromDate ? new Date(createFeedDto.fetchFromDate) : null,
      status: FeedStatus.DRAFT,
    });

    return this.feedRepository.save(feed);
  }

  async findAll(userId: string) {
    const feeds = await this.feedRepository
      .createQueryBuilder('feed')
      .leftJoin('feed.feedSources', 'feedSource')
      .leftJoinAndSelect('feed.feedChannel', 'feedChannel')
      .where('feed.userId = :userId', { userId })
      .select([
        'feed.id',
        'feed.userId',
        'feed.name',
        'feed.description',
        'feed.status',
        'feed.pollingIntervalSec',
        'feed.createdAt',
        'feed.updatedAt',
      ])
      .addSelect('feedChannel')
      .addSelect('COUNT(feedSource.id)', 'sourceCount')
      .groupBy('feed.id')
      .addGroupBy('feedChannel.id')
      .orderBy('feed.createdAt', 'DESC')
      .getRawAndEntities();

    return feeds.entities.map((feed, index) => ({
      ...feed,
      sourceCount: parseInt(feeds.raw[index].sourceCount) || 0,
    }));
  }

  async findOne(userId: string, feedId: string) {
    const result = await this.feedRepository
      .createQueryBuilder('feed')
      .leftJoin('feed.feedSources', 'feedSource')
      .leftJoinAndSelect('feed.feedChannel', 'feedChannel')
      .where('feed.id = :feedId', { feedId })
      .andWhere('feed.userId = :userId', { userId })
      .select([
        'feed.id',
        'feed.userId',
        'feed.name',
        'feed.description',
        'feed.status',
        'feed.pollingIntervalSec',
        'feed.createdAt',
        'feed.updatedAt',
      ])
      .addSelect('feedChannel')
      .addSelect('COUNT(feedSource.id)', 'sourceCount')
      .groupBy('feed.id')
      .addGroupBy('feedChannel.id')
      .getRawAndEntities();

    if (!result.entities[0]) {
      throw new NotFoundException('Feed not found');
    }

    return {
      ...result.entities[0],
      sourceCount: parseInt(result.raw[0].sourceCount) || 0,
    };
  }

  async update(userId: string, feedId: string, updateFeedDto: UpdateFeedDto): Promise<Feed> {
    const feed = await this.feedRepository.findOne({
      where: { id: feedId, userId },
    });

    if (!feed) {
      throw new NotFoundException('Feed not found');
    }

    if (updateFeedDto.name !== undefined) {
      feed.name = updateFeedDto.name;
    }

    if (updateFeedDto.description !== undefined) {
      feed.description = updateFeedDto.description || null;
    }

    if (updateFeedDto.pollingIntervalSec !== undefined) {
      feed.pollingIntervalSec = updateFeedDto.pollingIntervalSec;
    }

    return this.feedRepository.save(feed);
  }

  async delete(userId: string, feedId: string): Promise<void> {
    const feed = await this.feedRepository.findOne({
      where: { id: feedId, userId },
      relations: ['feedChannel'],
    });

    if (!feed) {
      throw new NotFoundException('Feed not found');
    }

    // Best-effort: delete Telegram channel before removing from DB
    if (feed.feedChannel?.telegramChannelId) {
      try {
        await this.tdlibService.deleteChannel(userId, Number(feed.feedChannel.telegramChannelId));
      } catch (err: any) {
        this.logger.warn(`Failed to delete Telegram channel for feed ${feedId}: ${err.message}`);
      }
    }

    await this.feedRepository.remove(feed);
  }

  /**
   * Add a source channel to a feed.
   */
  async addSource(userId: string, feedId: string, channelUsername: string): Promise<Feed> {
    const feed = await this.verifyFeedOwnership(userId, feedId);

    // Find existing source channel or fetch+upsert from TDLib
    let sourceChannel = await this.sourceChannelRepository.findOne({
      where: { username: channelUsername },
    });

    if (!sourceChannel) {
      sourceChannel = await this.channelsService.getChannelByUsername(userId, channelUsername);
    }

    // Check if source already exists
    const existingSource = await this.feedSourceRepository.findOne({
      where: {
        feedId: feed.id,
        sourceChannelId: sourceChannel.id,
      },
    });

    if (existingSource) {
      throw new BadRequestException('This channel is already added to the feed');
    }

    // Create feed source junction record
    const feedSource = this.feedSourceRepository.create({
      feedId: feed.id,
      sourceChannelId: sourceChannel.id,
      lastMessageId: null,
    });

    await this.feedSourceRepository.save(feedSource);

    // Return updated feed with source count
    return this.findOne(userId, feedId);
  }

  /**
   * Remove a source channel from a feed.
   */
  async removeSource(userId: string, feedId: string, sourceId: string): Promise<void> {
    const feed = await this.verifyFeedOwnership(userId, feedId);

    const feedSource = await this.feedSourceRepository.findOne({
      where: {
        id: sourceId,
        feedId: feed.id,
      },
    });

    if (!feedSource) {
      throw new NotFoundException('Source not found in this feed');
    }

    await this.feedSourceRepository.remove(feedSource);
  }

  /**
   * Get all sources for a feed with channel details.
   */
  async getSources(userId: string, feedId: string) {
    await this.verifyFeedOwnership(userId, feedId);

    const sources = await this.feedSourceRepository.find({
      where: { feedId },
      relations: ['sourceChannel'],
      order: { addedAt: 'DESC' },
    });

    return sources.map((source) => ({
      id: source.id,
      feedId: source.feedId,
      sourceChannelId: source.sourceChannelId,
      lastMessageId: source.lastMessageId,
      addedAt: source.addedAt,
      channel: source.sourceChannel,
    }));
  }

  /**
   * Create a Telegram channel for a feed (enqueues job).
   */
  async createChannel(userId: string, feedId: string) {
    const feed = await this.verifyFeedOwnership(userId, feedId);

    // Verify feed is in draft status
    if (feed.status !== FeedStatus.DRAFT) {
      throw new BadRequestException('Channel can only be created for draft feeds');
    }

    // Verify feed has at least one source
    const sourceCount = await this.feedSourceRepository.count({
      where: { feedId: feed.id },
    });

    if (sourceCount === 0) {
      throw new BadRequestException('Feed has no sources. Add at least one channel to aggregate from.');
    }

    // Verify user has active Telegram connection
    const isAuthorized = await this.tdlibService.isAuthorized(userId);
    if (!isAuthorized) {
      throw new BadRequestException('Telegram session expired. Please reconnect your Telegram account to continue.');
    }

    // Verify user has a bot
    const user = await this.usersService.findById(userId);
    if (!user?.userBot) {
      throw new BadRequestException('Bot not found. Please reconnect your Telegram account to create a bot.');
    }

    // Check if channel already exists or is being created
    const existingChannel = await this.feedChannelRepository.findOne({
      where: { feedId: feed.id },
    });

    if (existingChannel) {
      throw new BadRequestException('Channel already exists for this feed');
    }

    // Enqueue channel creation job
    const job = await this.queueService.enqueueChannelCreation(feedId, userId);

    return {
      jobId: job.id,
      message: 'Channel creation started',
    };
  }

  /**
   * Manually trigger a feed sync (fetch + post).
   */
  async syncFeed(userId: string, feedId: string) {
    const feed = await this.verifyFeedOwnership(userId, feedId);

    // Verify feed has a channel
    const feedChannel = await this.feedChannelRepository.findOne({
      where: { feedId: feed.id },
    });

    if (!feedChannel) {
      throw new BadRequestException('Feed has no channel. Create a channel first.');
    }

    // Verify feed has sources
    const sourceCount = await this.feedSourceRepository.count({
      where: { feedId: feed.id },
    });

    if (sourceCount === 0) {
      throw new BadRequestException('Feed has no sources to sync from');
    }

    // Enqueue fetch job (without recurring)
    const job = await this.queueService.enqueueFetchJob(feedId, userId);

    return {
      jobId: job.id,
      message: 'Manual sync started',
    };
  }

  /**
   * Pause a feed (stop recurring sync).
   */
  async pauseFeed(userId: string, feedId: string): Promise<Feed> {
    const feed = await this.verifyFeedOwnership(userId, feedId);

    if (feed.status !== FeedStatus.ACTIVE) {
      throw new BadRequestException('Only active feeds can be paused');
    }

    // Update status to paused
    feed.status = FeedStatus.PAUSED;
    await this.feedRepository.save(feed);

    // Unschedule recurring job
    await this.schedulerService.unscheduleFeed(feedId);

    return feed;
  }

  /**
   * Resume a paused feed (restart recurring sync).
   */
  async resumeFeed(userId: string, feedId: string): Promise<Feed> {
    const feed = await this.verifyFeedOwnership(userId, feedId);

    if (feed.status !== FeedStatus.PAUSED) {
      throw new BadRequestException('Only paused feeds can be resumed');
    }

    // Verify feed still has a channel
    const feedChannel = await this.feedChannelRepository.findOne({
      where: { feedId: feed.id },
    });

    if (!feedChannel) {
      throw new BadRequestException('Feed has no channel');
    }

    // Update status to active
    feed.status = FeedStatus.ACTIVE;
    await this.feedRepository.save(feed);

    // Schedule recurring job
    await this.schedulerService.scheduleFeed(feedId, userId, feed.pollingIntervalSec);

    return feed;
  }

  /**
   * Get recent aggregation jobs for a feed.
   */
  async getJobs(userId: string, feedId: string, limit: number = 20) {
    await this.verifyFeedOwnership(userId, feedId);

    const jobs = await this.aggregationJobRepository.find({
      where: { feed_id: feedId },
      order: { created_at: 'DESC' },
      take: limit,
    });

    return jobs;
  }

  private async verifyFeedOwnership(userId: string, feedId: string): Promise<Feed> {
    const feed = await this.feedRepository.findOne({
      where: { id: feedId, userId },
    });

    if (!feed) {
      throw new NotFoundException('Feed not found');
    }

    return feed;
  }
}
