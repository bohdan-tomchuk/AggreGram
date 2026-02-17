import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as tdl from 'tdl';
import { TdlibService } from './tdlib.service';
import { UserBot } from '../entities/user-bot.entity';
import { encrypt } from '../../../common/utils/encryption.util';

const BOT_DISPLAY_NAME = 'AggreGram Feed';
const USERNAME_PREFIX = 'agrgrm_';
const USERNAME_SUFFIX = '_bot';
const MAX_USERNAME_RETRIES = 5;
const MESSAGE_WAIT_TIMEOUT = 30_000;
const INTER_MESSAGE_DELAY = 1500;
const TOKEN_REGEX = /(\d+:[A-Za-z0-9_-]+)/;

@Injectable()
export class BotFactoryService {
  private readonly logger = new Logger(BotFactoryService.name);

  constructor(
    @InjectRepository(UserBot)
    private readonly botRepo: Repository<UserBot>,
    private readonly tdlibService: TdlibService,
  ) {}

  /**
   * Create a new bot via BotFather for the given user.
   * User must have an authenticated TDLib session.
   */
  async createBot(
    userId: string,
  ): Promise<{ botUsername: string; botTelegramId: string }> {
    const client = await this.tdlibService.getClient(userId);

    // 1. Find BotFather chat
    const botFatherChat = (await client.invoke({
      _: 'searchPublicChat',
      username: 'BotFather',
    })) as { id: number };
    const chatId = botFatherChat.id;
    this.logger.log(`Found BotFather chat: ${chatId}`);

    // 2. Send /newbot command
    let response = await this.sendAndWaitForResponse(
      client,
      chatId,
      '/newbot',
    );
    this.logger.debug(`BotFather response to /newbot: ${response.slice(0, 100)}`);

    // Check for "Too Many Bots" error
    if (
      response.toLowerCase().includes('too many') ||
      response.toLowerCase().includes('limit')
    ) {
      throw new BadRequestException(
        'You have reached the maximum number of bots (20). Please delete an existing bot via @BotFather first.',
      );
    }

    // 3. Send bot display name
    await this.delay(INTER_MESSAGE_DELAY);
    response = await this.sendAndWaitForResponse(
      client,
      chatId,
      BOT_DISPLAY_NAME,
    );
    this.logger.debug(
      `BotFather response to name: ${response.slice(0, 100)}`,
    );

    // 4. Try usernames with retries
    let botToken: string | null = null;
    let botUsername: string | null = null;

    for (let attempt = 0; attempt < MAX_USERNAME_RETRIES; attempt++) {
      const username = this.generateUsername();

      await this.delay(INTER_MESSAGE_DELAY);
      response = await this.sendAndWaitForResponse(client, chatId, username);
      this.logger.debug(
        `BotFather response to username "${username}": ${response.slice(0, 100)}`,
      );

      const tokenMatch = response.match(TOKEN_REGEX);
      if (tokenMatch) {
        botToken = tokenMatch[1];
        botUsername = username;
        break;
      }

      // Username taken or other issue — retry
      this.logger.warn(
        `Username ${username} rejected, retrying (${attempt + 1}/${MAX_USERNAME_RETRIES})`,
      );
    }

    if (!botToken || !botUsername) {
      throw new BadRequestException(
        'Failed to create bot after multiple username attempts. Please try again.',
      );
    }

    // 5. Validate token via Bot API
    const botInfo = await this.validateBotToken(botToken);

    // 6. Store in DB with encrypted token
    let bot = await this.botRepo.findOneBy({ userId });
    if (!bot) {
      bot = this.botRepo.create({ userId });
    }
    bot.botToken = encrypt(botToken);
    bot.botUsername = botUsername;
    bot.botTelegramId = botInfo.id;
    bot.status = 'active';
    await this.botRepo.save(bot);

    this.logger.log(
      `Created bot @${botUsername} (${botInfo.id}) for user ${userId}`,
    );

    return { botUsername, botTelegramId: botInfo.id };
  }

  /**
   * Validate a bot token by calling the Telegram Bot API /getMe endpoint.
   */
  async validateBotToken(
    token: string,
  ): Promise<{ id: string; username: string }> {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getMe`,
    );
    const data = (await res.json()) as {
      ok: boolean;
      result?: { id: number; username: string };
    };

    if (!data.ok || !data.result) {
      throw new BadRequestException('Bot token validation failed');
    }

    return {
      id: String(data.result.id),
      username: data.result.username,
    };
  }

  private generateUsername(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let random = '';
    for (let i = 0; i < 6; i++) {
      random += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${USERNAME_PREFIX}${random}${USERNAME_SUFFIX}`;
  }

  /**
   * Send a message to a chat and wait for a non-outgoing text response.
   * Registers the update listener before sending to avoid race conditions.
   */
  private sendAndWaitForResponse(
    client: tdl.Client,
    chatId: number,
    text: string,
    timeoutMs = MESSAGE_WAIT_TIMEOUT,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.off('update', handler);
        reject(new BadRequestException('BotFather response timed out'));
      }, timeoutMs);

      const handler = (update: Record<string, unknown>) => {
        if (update._ !== 'updateNewMessage') return;

        const message = update.message as Record<string, unknown> | undefined;
        if (!message) return;
        if (message.chat_id !== chatId) return;
        if (message.is_outgoing) return;

        const content = message.content as Record<string, unknown> | undefined;
        if (content?._ !== 'messageText') return;

        const msgText = content.text as Record<string, unknown> | undefined;
        const textStr = msgText?.text as string | undefined;
        if (!textStr) return;

        clearTimeout(timeout);
        client.off('update', handler);
        resolve(textStr);
      };

      client.on('update', handler);

      client
        .invoke({
          _: 'sendMessage',
          chat_id: chatId,
          input_message_content: {
            _: 'inputMessageText',
            text: { _: 'formattedText', text },
          },
        })
        .catch((err: Error) => {
          clearTimeout(timeout);
          client.off('update', handler);
          reject(err);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
