import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';

@Injectable()
export class TelegramService implements OnModuleInit {
  private client: TelegramClient;
  private readonly logger = new Logger(TelegramService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const apiId = this.configService.get<number>('telegram.apiId') || 0;
    const apiHash = this.configService.get<string>('telegram.apiHash') || '';
    const sessionString =
      this.configService.get<string>('telegram.sessionString') || '';

    this.client = new TelegramClient(
      new StringSession(sessionString),
      apiId,
      apiHash,
      {
        connectionRetries: 5,
        requestRetries: 3,
      },
    );

    await this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
      this.logger.log('Telegram client connected');

      if (!(await this.client.isUserAuthorized())) {
        this.logger.warn(
          'Telegram client not authorized. Please run authentication setup.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to connect to Telegram', error);
      throw error;
    }
  }

  async resolveChannel(username: string): Promise<{
    id: string;
    title: string;
    description?: string;
    subscriberCount?: number;
    photoUrl?: string;
  }> {
    try {
      const entity = await this.client.getEntity(username);

      if (!(entity instanceof Api.Channel)) {
        throw new Error('Entity is not a channel');
      }

      const fullChannel = await this.client.invoke(
        new Api.channels.GetFullChannel({ channel: entity }),
      );

      return {
        id: entity.id.toString(),
        title: entity.title || username,
        description: (fullChannel.fullChat as Api.ChannelFull).about,
        subscriberCount: (fullChannel.fullChat as Api.ChannelFull)
          .participantsCount,
        photoUrl: undefined, // TODO: implement photo download
      };
    } catch (error) {
      if (error.message?.includes('FLOOD_WAIT')) {
        const waitTime = parseInt(error.message.match(/\d+/)?.[0] || '60');
        throw new Error(`FLOOD_WAIT_${waitTime}`);
      }
      throw error;
    }
  }

  async fetchMessages(
    channelUsername: string,
    lastPostId?: string,
    limit = 100,
  ): Promise<any[]> {
    try {
      const entity = await this.client.getEntity(channelUsername);

      const messages = await this.client.getMessages(entity, {
        limit,
        minId: lastPostId ? parseInt(lastPostId) : undefined,
      });

      return messages.map((msg) => this.parseMessage(msg));
    } catch (error) {
      if (error.message?.includes('FLOOD_WAIT')) {
        const waitTime = parseInt(error.message.match(/\d+/)?.[0] || '60');
        throw new Error(`FLOOD_WAIT_${waitTime}`);
      }
      throw error;
    }
  }

  private parseMessage(message: Api.Message): any {
    if (!message || message.id === undefined) return null;

    let mediaType: 'photo' | 'video' | 'document' | undefined;
    let mediaFileId: string | undefined;

    if (message.media) {
      if (message.media instanceof Api.MessageMediaPhoto) {
        mediaType = 'photo';
        mediaFileId = (message.media.photo as Api.Photo)?.id?.toString();
      } else if (message.media instanceof Api.MessageMediaDocument) {
        const doc = message.media.document as Api.Document;
        if (doc.mimeType?.startsWith('video/')) {
          mediaType = 'video';
        } else {
          mediaType = 'document';
        }
        mediaFileId = doc.id?.toString();
      }
    }

    return {
      telegramPostId: message.id.toString(),
      textContent: message.message || null,
      hasMedia: !!message.media,
      mediaType,
      mediaFileId,
      views: message.views,
      forwards: message.forwards,
      postedAt: new Date(message.date * 1000),
      isEdited: !!message.editDate,
      editedAt: message.editDate ? new Date(message.editDate * 1000) : null,
    };
  }

  async downloadMedia(
    fileId: string,
    mediaType: 'photo' | 'video' | 'document',
  ): Promise<Buffer> {
    // TODO: Implement media download using file_id
    // This requires accessing the message that contains the media
    throw new Error('Media download not implemented yet');
  }
}
