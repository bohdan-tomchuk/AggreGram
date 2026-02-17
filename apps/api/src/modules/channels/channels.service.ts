import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TdlibService } from '../telegram/services/tdlib.service';
import { SourceChannel } from '../feeds/entities/source-channel.entity';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly tdlibService: TdlibService,
    @InjectRepository(SourceChannel)
    private readonly sourceChannelRepository: Repository<SourceChannel>,
  ) {}

  /**
   * Look up a single public Telegram channel by exact username.
   */
  async lookupChannelByUsername(userId: string, username: string): Promise<SourceChannel> {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    return this.getChannelByUsername(userId, cleanUsername);
  }

  /**
   * Get channel information by username.
   */
  async getChannelByUsername(userId: string, username: string): Promise<SourceChannel> {
    const chat = await this.tdlibService.searchPublicChat(userId, username);

    if (!chat || chat.type?._ !== 'chatTypeSupergroup' || !chat.type.is_channel) {
      throw new BadRequestException('Not a valid public channel');
    }

    const channelData = await this.mapChatToSourceChannel(userId, chat, username);
    if (!channelData) {
      throw new BadRequestException('Failed to retrieve channel information');
    }

    return this.upsertSourceChannel(channelData);
  }

  /**
   * Get user's joined channels from Telegram.
   */
  async getUserSubscriptions(userId: string): Promise<SourceChannel[]> {
    // For now, return empty array
    // TODO: Implement getChats from TDLib to fetch user's joined channels
    this.logger.warn('getUserSubscriptions not yet implemented');
    return [];
  }

  /**
   * Map TDLib chat object to SourceChannel entity.
   */
  private async mapChatToSourceChannel(userId: string, chat: any, inputUsername?: string): Promise<Partial<SourceChannel> | null> {
    try {
      const supergroupId = chat.type.supergroup_id;
      const telegramChannelId = String(chat.id);

      // Get full info if available
      let subscriberCount: number | null = null;
      let description: string | null = null;

      try {
        const fullInfo = await this.tdlibService.getSupergroupFullInfo(userId, supergroupId);
        if (fullInfo) {
          subscriberCount = fullInfo.member_count || null;
          description = fullInfo.description || null;
        }
      } catch (err) {
        // Full info might not be available, continue with basic info
        this.logger.debug(`Could not get full info for channel ${chat.id}`);
      }

      // Extract username: prefer TDLib response, fall back to user input
      let username: string | null = null;
      if (inputUsername) {
        username = inputUsername;
      }

      // Extract avatar URL if available
      let avatarUrl: string | null = null;
      if (chat.photo?.small?.id) {
        // For now, store the file ID; later we can implement file download
        avatarUrl = `tg://file/${chat.photo.small.id}`;
      }

      return {
        telegramChannelId,
        username,
        title: chat.title || 'Unnamed Channel',
        description,
        subscriberCount,
        avatarUrl,
        lastMetadataSync: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to map chat to source channel:`, error);
      return null;
    }
  }

  /**
   * Upsert source channel to database.
   */
  private async upsertSourceChannel(data: Partial<SourceChannel>): Promise<SourceChannel> {
    const existing = await this.sourceChannelRepository.findOne({
      where: { telegramChannelId: data.telegramChannelId! },
    });

    if (existing) {
      // Update existing record
      Object.assign(existing, {
        username: data.username,
        title: data.title,
        description: data.description,
        subscriberCount: data.subscriberCount,
        avatarUrl: data.avatarUrl,
        lastMetadataSync: data.lastMetadataSync,
      });
      return this.sourceChannelRepository.save(existing);
    }

    // Create new record
    const channel = this.sourceChannelRepository.create(data);
    return this.sourceChannelRepository.save(channel);
  }
}
