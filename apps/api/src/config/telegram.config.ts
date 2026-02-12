import { registerAs } from '@nestjs/config';

export default registerAs('telegram', () => ({
  apiId: parseInt(process.env.TELEGRAM_API_ID || '0', 10),
  apiHash: process.env.TELEGRAM_API_HASH || '',
  databaseDir: process.env.TDLIB_DATABASE_DIR || './tdlib-data',
}));
