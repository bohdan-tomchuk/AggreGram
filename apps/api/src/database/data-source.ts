import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../modules/users/user.entity';
import { RefreshToken } from '../modules/auth/refresh-token.entity';
import { TelegramConnection } from '../modules/telegram/entities/telegram-connection.entity';
import { UserBot } from '../modules/telegram/entities/user-bot.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'aggregram',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aggregram',
  entities: [User, RefreshToken, TelegramConnection, UserBot],
  synchronize: false,
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
});
