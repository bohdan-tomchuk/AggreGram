import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueService } from './queue.service';
import { ChannelProcessor } from './processors/channel.processor';
import { FetchProcessor } from './processors/fetch.processor';
import { PostProcessor } from './processors/post.processor';
import { SchedulerService } from './scheduler.service';
import { Feed } from '../feeds/entities/feed.entity';
import { FeedChannel } from '../feeds/entities/feed-channel.entity';
import { FeedSource } from '../feeds/entities/feed-source.entity';
import { AggregationJob } from '../feeds/entities/aggregation-job.entity';
import { UserBot } from '../telegram/entities/user-bot.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Feed,
      FeedChannel,
      FeedSource,
      AggregationJob,
      UserBot,
    ]),
    TelegramModule,
    UsersModule,
  ],
  providers: [
    QueueService,
    ChannelProcessor,
    FetchProcessor,
    PostProcessor,
    SchedulerService,
  ],
  exports: [QueueService, SchedulerService],
})
export class QueueModule {}
