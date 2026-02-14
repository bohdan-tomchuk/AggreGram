import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { Feed } from '../feeds/entities/feed.entity';
import { AggregationJob } from '../feeds/entities/aggregation-job.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Feed, AggregationJob]),
    TelegramModule,
    QueueModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
