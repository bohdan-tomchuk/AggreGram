import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../modules/users/user.entity';
import { RefreshToken } from '../modules/auth/refresh-token.entity';
import { TelegramConnection } from '../modules/telegram/entities/telegram-connection.entity';
import { UserBot } from '../modules/telegram/entities/user-bot.entity';
import { Feed } from '../modules/feeds/entities/feed.entity';
import { FeedChannel } from '../modules/feeds/entities/feed-channel.entity';
import { FeedSource } from '../modules/feeds/entities/feed-source.entity';
import { SourceChannel } from '../modules/feeds/entities/source-channel.entity';
import { AggregationJob } from '../modules/feeds/entities/aggregation-job.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [
          User,
          RefreshToken,
          TelegramConnection,
          UserBot,
          Feed,
          FeedChannel,
          FeedSource,
          SourceChannel,
          AggregationJob,
        ],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
