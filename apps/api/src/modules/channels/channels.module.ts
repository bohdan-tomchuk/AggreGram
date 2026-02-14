import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourceChannel } from '../feeds/entities/source-channel.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SourceChannel]),
    TelegramModule,
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
