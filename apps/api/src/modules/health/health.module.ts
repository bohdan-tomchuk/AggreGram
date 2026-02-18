import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { TelegramModule } from '../telegram/telegram.module';
import { AggregationJob } from '../feeds/entities/aggregation-job.entity';
import { Feed } from '../feeds/entities/feed.entity';

@Module({
  imports: [
    TelegramModule,
    TypeOrmModule.forFeature([AggregationJob, Feed]),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
