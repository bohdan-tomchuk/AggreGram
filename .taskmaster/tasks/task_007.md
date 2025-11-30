# Task ID: 7

**Title:** Set Up Telegram Crawler with GramJS and BullMQ

**Status:** pending

**Dependencies:** 6

**Priority:** high

**Description:** Implement Telegram integration using GramJS for MTProto communication, set up Redis with BullMQ for job queue, and create crawler service for channel resolution and post fetching with rate limit handling.

**Details:**

1. Install dependencies:
```bash
cd apps/api
pnpm add telegram bullmq ioredis sharp
pnpm add -D @types/sharp
```

2. Create apps/api/src/config/redis.config.ts:
```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
}));
```

3. Create apps/api/src/config/telegram.config.ts:
```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('telegram', () => ({
  apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
  apiHash: process.env.TELEGRAM_API_HASH || '',
  sessionString: process.env.TELEGRAM_SESSION_STRING,
  phoneNumber: process.env.TELEGRAM_PHONE_NUMBER,
}));
```

4. Create apps/api/src/modules/crawler/telegram.service.ts:
```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import * as input from 'telegram/client/inputs';

@Injectable()
export class TelegramService implements OnModuleInit {
  private client: TelegramClient;
  private readonly logger = new Logger(TelegramService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const apiId = this.configService.get<number>('telegram.apiId');
    const apiHash = this.configService.get<string>('telegram.apiHash');
    const sessionString = this.configService.get<string>('telegram.sessionString') || '';

    this.client = new TelegramClient(
      new StringSession(sessionString),
      apiId,
      apiHash,
      {
        connectionRetries: 5,
        requestRetries: 3,
      },
    );

    await this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
      this.logger.log('Telegram client connected');
      
      if (!await this.client.isUserAuthorized()) {
        this.logger.warn('Telegram client not authorized. Please run authentication setup.');
      }
    } catch (error) {
      this.logger.error('Failed to connect to Telegram', error);
      throw error;
    }
  }

  async resolveChannel(username: string): Promise<{
    id: string;
    title: string;
    description?: string;
    subscriberCount?: number;
    photoUrl?: string;
  }> {
    try {
      const entity = await this.client.getEntity(username);
      
      if (!(entity instanceof Api.Channel)) {
        throw new Error('Entity is not a channel');
      }

      const fullChannel = await this.client.invoke(
        new Api.channels.GetFullChannel({ channel: entity }),
      );

      return {
        id: entity.id.toString(),
        title: entity.title || username,
        description: (fullChannel.fullChat as Api.ChannelFull).about,
        subscriberCount: (fullChannel.fullChat as Api.ChannelFull).participantsCount,
        photoUrl: undefined, // TODO: implement photo download
      };
    } catch (error) {
      if (error.message?.includes('FLOOD_WAIT')) {
        const waitTime = parseInt(error.message.match(/\d+/)?.[0] || '60');
        throw new Error(`FLOOD_WAIT_${waitTime}`);
      }
      throw error;
    }
  }

  async fetchMessages(channelUsername: string, lastPostId?: string, limit = 100): Promise<any[]> {
    try {
      const entity = await this.client.getEntity(channelUsername);
      
      const messages = await this.client.getMessages(entity, {
        limit,
        minId: lastPostId ? parseInt(lastPostId) : undefined,
      });

      return messages.map(msg => this.parseMessage(msg));
    } catch (error) {
      if (error.message?.includes('FLOOD_WAIT')) {
        const waitTime = parseInt(error.message.match(/\d+/)?.[0] || '60');
        throw new Error(`FLOOD_WAIT_${waitTime}`);
      }
      throw error;
    }
  }

  private parseMessage(message: Api.Message): any {
    if (!message || message.id === undefined) return null;

    let mediaType: 'photo' | 'video' | 'document' | undefined;
    let mediaFileId: string | undefined;

    if (message.media) {
      if (message.media instanceof Api.MessageMediaPhoto) {
        mediaType = 'photo';
        mediaFileId = (message.media.photo as Api.Photo)?.id?.toString();
      } else if (message.media instanceof Api.MessageMediaDocument) {
        const doc = message.media.document as Api.Document;
        if (doc.mimeType?.startsWith('video/')) {
          mediaType = 'video';
        } else {
          mediaType = 'document';
        }
        mediaFileId = doc.id?.toString();
      }
    }

    return {
      telegramPostId: message.id.toString(),
      textContent: message.message || null,
      hasMedia: !!message.media,
      mediaType,
      mediaFileId,
      views: message.views,
      forwards: message.forwards,
      postedAt: new Date(message.date * 1000),
      isEdited: !!message.editDate,
      editedAt: message.editDate ? new Date(message.editDate * 1000) : null,
    };
  }

  async downloadMedia(fileId: string, mediaType: 'photo' | 'video' | 'document'): Promise<Buffer> {
    // TODO: Implement media download using file_id
    // This requires accessing the message that contains the media
    throw new Error('Media download not implemented yet');
  }
}
```

5. Create apps/api/src/modules/crawler/jobs/crawl-channel.job.ts:
```typescript
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
      const channel = await this.channelsRepository.findOne({ where: { id: channelId } });
      if (!channel || !channel.isActive) {
        this.logger.warn(`Channel ${channelId} not found or inactive`);
        return;
      }

      // If telegramId is 0, resolve channel first
      if (channel.telegramId === '0') {
        const metadata = await this.telegramService.resolveChannel(channel.username!);
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

      this.logger.log(`Fetched ${messages.length} messages for channel ${channel.username}`);

      // Save posts
      for (const msg of messages.filter(m => m !== null)) {
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
        }
      }

      // Update channel last crawl info
      if (messages.length > 0) {
        const maxPostId = Math.max(...messages.map(m => parseInt(m.telegramPostId)));
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
```

6. Create apps/api/src/modules/crawler/crawler.module.ts:
```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import redisConfig from '../../config/redis.config';
import telegramConfig from '../../config/telegram.config';
import { Channel } from '../../database/entities/channel.entity';
import { Post } from '../../database/entities/post.entity';
import { TelegramService } from './telegram.service';
import { CrawlChannelProcessor } from './jobs/crawl-channel.job';
import { CrawlerService } from './crawler.service';

@Module({
  imports: [
    ConfigModule.forFeature(redisConfig),
    ConfigModule.forFeature(telegramConfig),
    TypeOrmModule.forFeature([Channel, Post]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('redis.host'),
          port: config.get('redis.port'),
          password: config.get('redis.password'),
        },
      }),
    }),
    BullModule.registerQueue({ name: 'crawl' }),
  ],
  providers: [TelegramService, CrawlChannelProcessor, CrawlerService],
  exports: [CrawlerService, TelegramService],
})
export class CrawlerModule {}
```

7. Create apps/api/src/modules/crawler/crawler.service.ts:
```typescript
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
```

8. Install @nestjs/schedule:
```bash
pnpm add @nestjs/schedule
```

9. Update .env.example:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION_STRING=
TELEGRAM_PHONE_NUMBER=
```

**Test Strategy:**

1. Unit tests for TelegramService:
   - resolveChannel returns channel metadata for valid username
   - resolveChannel throws for invalid username
   - fetchMessages returns parsed messages
   - parseMessage extracts text, media type, and metadata correctly
   - FLOOD_WAIT errors are caught and re-thrown with wait time
2. Unit tests for CrawlChannelProcessor:
   - process resolves channel if telegramId is 0
   - process saves new posts to database
   - process updates edited posts
   - process handles FLOOD_WAIT with exponential backoff
3. Integration test:
   - Mock TelegramClient
   - Queue crawl job with test channel
   - Verify posts saved to database
4. Test CrawlerService scheduled job:
   - Verify cron runs every 30 minutes
   - Verify all active channels queued
5. E2E test with real Telegram API (using test channel):
   - Add channel -> crawl job executes -> posts appear in database
6. Test rate limit handling with multiple rapid crawls

## Subtasks

### 7.1. Install Redis, BullMQ, GramJS and dependencies

**Status:** pending  
**Dependencies:** None  

Install telegram, bullmq, ioredis, sharp packages and their TypeScript type definitions for Telegram crawler functionality.

**Details:**

Run `cd apps/api && pnpm add telegram bullmq ioredis sharp && pnpm add -D @types/sharp` to install GramJS client library, BullMQ job queue, Redis client, and image processing library. Also install @nestjs/schedule with `pnpm add @nestjs/schedule` for cron job scheduling.

### 7.2. Create Redis and Telegram configuration modules

**Status:** pending  
**Dependencies:** 7.1  

Set up configuration files for Redis connection and Telegram API credentials using NestJS ConfigModule.

**Details:**

Create apps/api/src/config/redis.config.ts with registerAs('redis') exporting host, port, and password from environment variables. Create apps/api/src/config/telegram.config.ts with registerAs('telegram') exporting apiId, apiHash, sessionString, and phoneNumber. Update .env.example with REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_STRING, and TELEGRAM_PHONE_NUMBER.

### 7.3. Implement TelegramService with GramJS client initialization

**Status:** pending  
**Dependencies:** 7.2  

Create TelegramService with TelegramClient setup, connection handling, and session management using StringSession.

**Details:**

Create apps/api/src/modules/crawler/telegram.service.ts with @Injectable decorator. Inject ConfigService, initialize TelegramClient in onModuleInit with apiId, apiHash, and StringSession. Implement connect() method with connection retry logic (connectionRetries: 5, requestRetries: 3). Add authorization check and log warning if user not authorized. Handle connection errors and log appropriately.

### 7.4. Implement channel resolution with metadata extraction

**Status:** pending  
**Dependencies:** 7.3  

Build resolveChannel method to fetch Telegram channel metadata including ID, title, description, and subscriber count.

**Details:**

In TelegramService, implement resolveChannel(username: string) that calls client.getEntity(username), validates it's a Channel instance, invokes channels.GetFullChannel API, and returns object with id, title, description, subscriberCount, and photoUrl (undefined for now). Handle errors and check for FLOOD_WAIT in error message, extracting wait time with regex and throwing formatted error.

### 7.5. Build message fetching with pagination support

**Status:** pending  
**Dependencies:** 7.3  

Implement fetchMessages method to retrieve channel posts with limit and offset based on lastPostId.

**Details:**

In TelegramService, implement fetchMessages(channelUsername: string, lastPostId?: string, limit = 100) that calls client.getEntity(channelUsername), then client.getMessages with limit and minId (parsed from lastPostId if provided). Map returned messages through parseMessage helper. Handle FLOOD_WAIT errors same as resolveChannel method.

### 7.6. Create message parser for text and media extraction

**Status:** pending  
**Dependencies:** 7.5  

Implement parseMessage helper to extract post content, media type, metadata, and statistics from Telegram Api.Message objects.

**Details:**

In TelegramService, implement private parseMessage(message: Api.Message) that returns null for invalid messages. Extract telegramPostId, textContent (message.message), check hasMedia presence. Detect mediaType (photo/video/document) by checking MessageMediaPhoto and MessageMediaDocument with mimeType. Extract mediaFileId from photo.id or document.id. Include views, forwards, postedAt (convert Unix timestamp), isEdited flag, and editedAt date.

### 7.7. Implement FLOOD_WAIT error detection and formatting

**Status:** pending  
**Dependencies:** 7.4, 7.5  

Add comprehensive FLOOD_WAIT error handling across all Telegram API methods with wait time extraction.

**Details:**

In TelegramService resolveChannel and fetchMessages methods, wrap API calls in try-catch. Check if error.message includes 'FLOOD_WAIT' string. Use regex /\d+/ to extract wait time in seconds from error message. Throw new Error with format 'FLOOD_WAIT_{waitTime}' to be handled by job processor. Default to 60 seconds if regex match fails.

### 7.8. Create CrawlChannelProcessor with BullMQ job logic

**Status:** pending  
**Dependencies:** 7.6, 7.7  

Build BullMQ worker processor to handle channel crawling jobs with Telegram API calls and database persistence.

**Details:**

Create apps/api/src/modules/crawler/jobs/crawl-channel.job.ts with @Processor('crawl', { concurrency: 2 }) decorator extending WorkerHost. Inject TelegramService and TypeORM repositories for Channel and Post. Implement process(job: Job<CrawlChannelData>) that loads channel from DB, checks isActive flag, resolves channel if telegramId is '0', fetches messages, and returns message count. Add @OnWorkerEvent('failed') handler to log errors.

### 7.9. Implement incremental crawling and post deduplication

**Status:** pending  
**Dependencies:** 7.8  

Add logic to fetch only new posts using lastPostId and handle post updates for edited messages.

**Details:**

In CrawlChannelProcessor.process, pass channel.lastPostId to fetchMessages for incremental crawling. Loop through returned messages and check if post exists using findOne with channelId and telegramPostId. For existing posts, check isEdited flag and update with Object.assign and save if edited. For new posts, create using postsRepository.create and save. After processing, update channel.lastPostId to max telegramPostId from fetched messages and set channel.lastCrawledAt to current date.

### 7.10. Build CrawlerService with cron scheduling

**Status:** pending  
**Dependencies:** 7.8  

Create CrawlerService to manage job queue and schedule periodic crawls every 30 minutes using @nestjs/schedule.

**Details:**

Create apps/api/src/modules/crawler/crawler.service.ts with @Injectable decorator. Inject @InjectQueue('crawl') Queue and Channel repository. Implement onModuleInit to call queueActiveChannels on startup. Add @Cron(CronExpression.EVERY_30_MINUTES) decorator on scheduledCrawl method. Implement queueActiveChannels to find all channels with isActive=true and call queueChannelCrawl for each. Implement queueChannelCrawl to add job with attempts: 3 and exponential backoff with 60s delay.

### 7.11. Set up CrawlerModule with BullMQ and TypeORM configuration

**Status:** pending  
**Dependencies:** 7.9, 7.10  

Create NestJS module wiring together Redis, BullMQ queue, TypeORM entities, and crawler services.

**Details:**

Create apps/api/src/modules/crawler/crawler.module.ts with @Module decorator. Import ConfigModule.forFeature for redis and telegram configs, TypeOrmModule.forFeature([Channel, Post]), BullModule.forRootAsync with Redis connection from ConfigService, and BullModule.registerQueue({ name: 'crawl' }). Add TelegramService, CrawlChannelProcessor, and CrawlerService to providers. Export CrawlerService and TelegramService for use in other modules.

### 7.12. Write integration tests with mocked Telegram client

**Status:** pending  
**Dependencies:** 7.11  

Create comprehensive integration tests for crawler flow using mocked TelegramClient to simulate API responses.

**Details:**

Create test file apps/api/src/modules/crawler/crawler.integration.spec.ts. Mock TelegramClient.connect, getEntity, invoke, and getMessages methods. Create test scenarios: 1) Full crawl of new channel with resolution, 2) Incremental crawl with lastPostId, 3) FLOOD_WAIT handling and job retry, 4) Post deduplication and updates, 5) Cron scheduling triggers jobs. Use in-memory SQLite database for TypeORM. Verify job queue operations and database state after each scenario.
