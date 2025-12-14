import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
    ScheduleModule.forRoot(),
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
  providers: [
    TelegramService,
    CrawlChannelProcessor,
    CrawlerService,
  ],
  exports: [CrawlerService, TelegramService],
})
export class CrawlerModule {}
