import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function main() {
  console.log('=== Telegram Session Generator ===\n');

  const apiId = parseInt(await question('Enter API ID: '));
  const apiHash = await question('Enter API Hash: ');
  const phoneNumber = await question('Enter phone number (with country code, e.g., +1234567890): ');

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => phoneNumber,
    password: async () => await question('Enter 2FA password (press Enter if not enabled): '),
    phoneCode: async () => await question('Enter verification code from Telegram: '),
    onError: (err) => console.error('Error:', err),
  });

  console.log('\n✓ Authentication successful!\n');
  console.log('Session string:');
  console.log('─'.repeat(80));
  console.log(client.session.save());
  console.log('─'.repeat(80));
  console.log('\nCopy this to TELEGRAM_SESSION_STRING in .env file\n');

  await client.disconnect();
  rl.close();
}

main().catch(err => {
  console.error('Failed to generate session:', err);
  rl.close();
  process.exit(1);
});
