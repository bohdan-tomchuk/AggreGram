import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramConnection } from './entities/telegram-connection.entity';
import { UserBot } from './entities/user-bot.entity';
import { TdlibService } from './services/tdlib.service';
import { ConnectionService } from './services/connection.service';
import { BotFactoryService } from './services/bot-factory.service';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TelegramConnection, UserBot])],
  controllers: [TelegramController],
  providers: [TdlibService, ConnectionService, BotFactoryService],
  exports: [TdlibService, ConnectionService, BotFactoryService],
})
export class TelegramModule {}
