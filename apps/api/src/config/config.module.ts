import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import authConfig from './auth.config';
import databaseConfig from './database.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, authConfig, databaseConfig],
    }),
  ],
})
export class ConfigModule {}
