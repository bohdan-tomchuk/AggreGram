import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feed } from './entities/feed.entity';
import { FeedChannel } from './entities/feed-channel.entity';
import { FeedSource } from './entities/feed-source.entity';
import { SourceChannel } from './entities/source-channel.entity';
import { AggregationJob } from './entities/aggregation-job.entity';
import { FeedsService } from './feeds.service';
import { FeedsController } from './feeds.controller';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Feed,
      FeedChannel,
      FeedSource,
      SourceChannel,
      AggregationJob,
    ]),
    UsersModule,
    TelegramModule,
    ChannelsModule,
  ],
  controllers: [FeedsController],
  providers: [FeedsService],
  exports: [FeedsService],
})
export class FeedsModule {}
