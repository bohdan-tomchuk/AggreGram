import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TelegramClient } from 'telegram';
import { Api } from 'telegram/tl';
import { CrawlerModule } from '../src/modules/crawler/crawler.module';
import { CrawlerService } from '../src/modules/crawler/crawler.service';
import { TelegramService } from '../src/modules/crawler/telegram.service';
import { Channel } from '../src/database/entities/channel.entity';
import { Post } from '../src/database/entities/post.entity';
import databaseConfig from '../src/config/database.config';
import redisConfig from '../src/config/redis.config';
import telegramConfig from '../src/config/telegram.config';

// Mock TelegramClient
jest.mock('telegram', () => {
  return {
    TelegramClient: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      isUserAuthorized: jest.fn().mockResolvedValue(true),
      getEntity: jest.fn(),
      invoke: jest.fn(),
      getMessages: jest.fn(),
    })),
    Api: {
      Channel: jest.fn(),
      channels: {
        GetFullChannel: jest.fn(),
      },
      ChannelFull: jest.fn(),
      Message: jest.fn(),
      MessageMediaPhoto: jest.fn(),
      MessageMediaDocument: jest.fn(),
      Photo: jest.fn(),
      Document: jest.fn(),
    },
  };
});

jest.mock('telegram/sessions', () => {
  return {
    StringSession: jest.fn().mockImplementation(() => ({})),
  };
});

describe('Crawler Integration Tests (e2e)', () => {
  let app: INestApplication;
  let crawlerService: CrawlerService;
  let telegramService: TelegramService;
  let channelsRepository: any;
  let postsRepository: any;
  let crawlQueue: Queue;
  let mockTelegramClient: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, redisConfig, telegramConfig],
        }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            ...config.get('database'),
            dropSchema: true,
            synchronize: true,
          }),
        }),
        CrawlerModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    crawlerService = moduleFixture.get<CrawlerService>(CrawlerService);
    telegramService = moduleFixture.get<TelegramService>(TelegramService);
    crawlQueue = moduleFixture.get<Queue>(getQueueToken('crawl'));

    // Get repositories
    const connection = app.get('DataSource');
    channelsRepository = connection.getRepository(Channel);
    postsRepository = connection.getRepository(Post);

    // Get mocked telegram client
    mockTelegramClient = (telegramService as any).client;
  });

  afterAll(async () => {
    await crawlQueue.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clear repositories
    await postsRepository.delete({});
    await channelsRepository.delete({});

    // Clear queue
    await crawlQueue.drain();
    await crawlQueue.clean(0, 1000, 'completed');
    await crawlQueue.clean(0, 1000, 'failed');

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('TelegramService', () => {
    it('should resolve channel metadata', async () => {
      const mockChannel = {
        id: BigInt(123456789),
        title: 'Test Channel',
        className: 'Channel',
      };

      const mockFullChannel = {
        fullChat: {
          about: 'Test Description',
          participantsCount: 1000,
        },
      };

      mockTelegramClient.getEntity.mockResolvedValue(mockChannel);
      mockTelegramClient.invoke.mockResolvedValue(mockFullChannel);

      // Create custom instance check
      Object.setPrototypeOf(mockChannel, Api.Channel.prototype);

      const result = await telegramService.resolveChannel('testchannel');

      expect(result).toEqual({
        id: '123456789',
        title: 'Test Channel',
        description: 'Test Description',
        subscriberCount: 1000,
        photoUrl: undefined,
      });

      expect(mockTelegramClient.getEntity).toHaveBeenCalledWith('testchannel');
    });

    it('should throw error for non-channel entities', async () => {
      const mockUser = {
        id: BigInt(123456789),
        className: 'User',
      };

      mockTelegramClient.getEntity.mockResolvedValue(mockUser);

      await expect(
        telegramService.resolveChannel('testuser'),
      ).rejects.toThrow('Entity is not a channel');
    });

    it('should handle FLOOD_WAIT errors', async () => {
      const floodError = new Error('FLOOD_WAIT_60');
      mockTelegramClient.getEntity.mockRejectedValue(floodError);

      await expect(
        telegramService.resolveChannel('testchannel'),
      ).rejects.toThrow('FLOOD_WAIT_60');
    });

    it('should fetch and parse messages', async () => {
      const mockEntity = {
        id: BigInt(123456789),
        className: 'Channel',
      };

      const mockMessages = [
        {
          id: 1,
          message: 'Test message',
          date: Math.floor(Date.now() / 1000),
          views: 100,
          forwards: 10,
          editDate: null,
          media: null,
        },
        {
          id: 2,
          message: 'Another message',
          date: Math.floor(Date.now() / 1000),
          views: 200,
          forwards: 20,
          editDate: Math.floor(Date.now() / 1000),
          media: null,
        },
      ];

      mockTelegramClient.getEntity.mockResolvedValue(mockEntity);
      mockTelegramClient.getMessages.mockResolvedValue(mockMessages);

      const result = await telegramService.fetchMessages('testchannel');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        telegramPostId: '1',
        textContent: 'Test message',
        hasMedia: false,
        views: 100,
        forwards: 10,
        isEdited: false,
      });
      expect(result[1].isEdited).toBe(true);
    });

    it('should parse messages with media', async () => {
      const mockEntity = {
        id: BigInt(123456789),
        className: 'Channel',
      };

      const mockPhotoMessage = {
        id: 1,
        message: 'Photo message',
        date: Math.floor(Date.now() / 1000),
        views: 100,
        forwards: 10,
        editDate: null,
        media: {
          className: 'MessageMediaPhoto',
          photo: {
            id: BigInt(999),
          },
        },
      };

      // Set up prototype for instanceof check
      Object.setPrototypeOf(
        mockPhotoMessage.media,
        Api.MessageMediaPhoto.prototype,
      );

      mockTelegramClient.getEntity.mockResolvedValue(mockEntity);
      mockTelegramClient.getMessages.mockResolvedValue([mockPhotoMessage]);

      const result = await telegramService.fetchMessages('testchannel');

      expect(result[0]).toMatchObject({
        telegramPostId: '1',
        hasMedia: true,
        mediaType: 'photo',
        mediaFileId: '999',
      });
    });
  });

  describe('CrawlerService', () => {
    it('should queue active channels for crawling', async () => {
      // Create test channels
      const channel1 = channelsRepository.create({
        id: '1',
        username: 'testchannel1',
        telegramId: '123',
        isActive: true,
      });
      const channel2 = channelsRepository.create({
        id: '2',
        username: 'testchannel2',
        telegramId: '456',
        isActive: true,
      });
      const channel3 = channelsRepository.create({
        id: '3',
        username: 'inactive',
        telegramId: '789',
        isActive: false,
      });

      await channelsRepository.save([channel1, channel2, channel3]);

      await crawlerService.queueActiveChannels();

      const jobs = await crawlQueue.getJobs(['waiting', 'active']);

      expect(jobs.length).toBe(2);
      expect(jobs.map((j) => j.data.channelId)).toContain('1');
      expect(jobs.map((j) => j.data.channelId)).toContain('2');
      expect(jobs.map((j) => j.data.channelId)).not.toContain('3');
    });

    it('should queue single channel crawl with retry configuration', async () => {
      await crawlerService.queueChannelCrawl('test-id');

      const jobs = await crawlQueue.getJobs(['waiting']);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data).toEqual({ channelId: 'test-id' });
      expect(jobs[0].opts.attempts).toBe(3);
      expect(jobs[0].opts.backoff).toEqual({
        type: 'exponential',
        delay: 60000,
      });
    });
  });

  describe('CrawlChannelProcessor', () => {
    it('should skip inactive or non-existent channels', async () => {
      const channel = channelsRepository.create({
        id: 'test-id',
        username: 'testchannel',
        telegramId: '123',
        isActive: false,
      });
      await channelsRepository.save(channel);

      await crawlerService.queueChannelCrawl('test-id');

      // Wait for job to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(mockTelegramClient.getEntity).not.toHaveBeenCalled();
    });

    it('should resolve channel if telegramId is 0', async () => {
      const channel = channelsRepository.create({
        id: 'test-id',
        username: 'testchannel',
        telegramId: '0',
        isActive: true,
      });
      await channelsRepository.save(channel);

      const mockChannel = {
        id: BigInt(999),
        title: 'Resolved Channel',
        className: 'Channel',
      };

      const mockFullChannel = {
        fullChat: {
          about: 'Resolved Description',
          participantsCount: 500,
        },
      };

      Object.setPrototypeOf(mockChannel, Api.Channel.prototype);
      mockTelegramClient.getEntity.mockResolvedValue(mockChannel);
      mockTelegramClient.invoke.mockResolvedValue(mockFullChannel);
      mockTelegramClient.getMessages.mockResolvedValue([]);

      await crawlerService.queueChannelCrawl('test-id');

      // Wait for job to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const updatedChannel = await channelsRepository.findOne({
        where: { id: 'test-id' },
      });

      expect(updatedChannel.telegramId).toBe('999');
      expect(updatedChannel.title).toBe('Resolved Channel');
      expect(updatedChannel.description).toBe('Resolved Description');
      expect(updatedChannel.subscriberCount).toBe(500);
    });

    it('should save new posts and update channel lastPostId', async () => {
      const channel = channelsRepository.create({
        id: 'test-id',
        username: 'testchannel',
        telegramId: '123',
        isActive: true,
      });
      await channelsRepository.save(channel);

      const mockEntity = {
        id: BigInt(123),
        className: 'Channel',
      };

      const mockMessages = [
        {
          id: 100,
          message: 'Message 1',
          date: Math.floor(Date.now() / 1000),
          views: 50,
          forwards: 5,
          editDate: null,
          media: null,
        },
        {
          id: 101,
          message: 'Message 2',
          date: Math.floor(Date.now() / 1000),
          views: 60,
          forwards: 6,
          editDate: null,
          media: null,
        },
      ];

      mockTelegramClient.getEntity.mockResolvedValue(mockEntity);
      mockTelegramClient.getMessages.mockResolvedValue(mockMessages);

      await crawlerService.queueChannelCrawl('test-id');

      // Wait for job to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const posts = await postsRepository.find({
        where: { channelId: 'test-id' },
      });
      const updatedChannel = await channelsRepository.findOne({
        where: { id: 'test-id' },
      });

      expect(posts).toHaveLength(2);
      expect(posts[0].telegramPostId).toBe('100');
      expect(posts[1].telegramPostId).toBe('101');
      expect(updatedChannel.lastPostId).toBe('101');
      expect(updatedChannel.lastCrawledAt).toBeDefined();
    });

    it('should update edited posts', async () => {
      const channel = channelsRepository.create({
        id: 'test-id',
        username: 'testchannel',
        telegramId: '123',
        isActive: true,
      });
      await channelsRepository.save(channel);

      // Create existing post
      const existingPost = postsRepository.create({
        channelId: 'test-id',
        telegramPostId: '100',
        textContent: 'Old content',
        hasMedia: false,
        postedAt: new Date(),
        isEdited: false,
      });
      await postsRepository.save(existingPost);

      const mockEntity = {
        id: BigInt(123),
        className: 'Channel',
      };

      const editTime = Math.floor(Date.now() / 1000);
      const mockMessages = [
        {
          id: 100,
          message: 'Updated content',
          date: Math.floor(Date.now() / 1000) - 3600,
          views: 50,
          forwards: 5,
          editDate: editTime,
          media: null,
        },
      ];

      mockTelegramClient.getEntity.mockResolvedValue(mockEntity);
      mockTelegramClient.getMessages.mockResolvedValue(mockMessages);

      await crawlerService.queueChannelCrawl('test-id');

      // Wait for job to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const posts = await postsRepository.find({
        where: { channelId: 'test-id' },
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].textContent).toBe('Updated content');
      expect(posts[0].isEdited).toBe(true);
      expect(posts[0].editedAt).toBeDefined();
    });
  });
});
