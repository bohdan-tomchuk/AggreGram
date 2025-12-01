import { registerAs } from '@nestjs/config';

export default registerAs('telegram', () => ({
  apiId: parseInt(process.env.TELEGRAM_API_ID || '0', 10),
  apiHash: process.env.TELEGRAM_API_HASH || '',
  sessionString: process.env.TELEGRAM_SESSION_STRING,
  phoneNumber: process.env.TELEGRAM_PHONE_NUMBER,
}));
