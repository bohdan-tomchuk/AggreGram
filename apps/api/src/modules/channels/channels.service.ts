import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from '../../database/entities/channel.entity';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { TelegramService } from '../crawler/telegram.service';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    @InjectRepository(Channel)
    private channelsRepository: Repository<Channel>,
    private telegramService: TelegramService,
  ) {}

  private parseUsername(input: string): string {
    const patterns = [
      /^@([a-zA-Z0-9_]+)$/,
      /^t\.me\/([a-zA-Z0-9_]+)$/,
      /^https?:\/\/t\.me\/([a-zA-Z0-9_]+)$/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }

    throw new BadRequestException('Invalid channel username or link format');
  }

  async create(dto: CreateChannelDto): Promise<Channel> {
    const username = this.parseUsername(dto.usernameOrLink);

    const existing = await this.channelsRepository.findOne({
      where: { username },
    });
    if (existing) {
      throw new ConflictException('Channel already exists');
    }

    // Fetch channel information from Telegram
    let channelInfo: {
      id: string;
      title: string;
      description?: string;
      subscriberCount?: number;
      photoUrl?: string;
    };

    try {
      this.logger.log(
        `Fetching channel info from Telegram for username: ${username}`,
      );
      channelInfo = await this.telegramService.resolveChannel(username);
      this.logger.log(
        `Successfully fetched channel info: ${channelInfo.title}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to fetch channel info from Telegram: ${errorMessage}`,
      );

      if (errorMessage.startsWith('FLOOD_WAIT_')) {
        const waitTime = parseInt(errorMessage.split('_')[2] || '60');
        throw new BadRequestException(
          `Telegram API rate limit exceeded. Please try again in ${waitTime} seconds.`,
        );
      }

      throw new BadRequestException(
        `Failed to fetch channel from Telegram: ${errorMessage}. Please verify the channel exists and is accessible.`,
      );
    }

    // Check if channel already exists by telegramId
    const existingById = await this.channelsRepository.findOne({
      where: { telegramId: channelInfo.id },
    });
    if (existingById) {
      throw new ConflictException(
        'Channel already exists with this Telegram ID',
      );
    }

    const channel = this.channelsRepository.create({
      username,
      telegramId: channelInfo.id,
      title: channelInfo.title,
      description: channelInfo.description,
      subscriberCount: channelInfo.subscriberCount,
      photoUrl: channelInfo.photoUrl,
      topic: dto.topic,
      channelType: dto.channelType,
      crawlPriority: dto.crawlPriority || 5,
      isActive: true,
    });

    return this.channelsRepository.save(channel);
  }

  async findAll(filters?: {
    topic?: string;
    channelType?: string;
    isActive?: boolean;
  }): Promise<Channel[]> {
    const query = this.channelsRepository.createQueryBuilder('channel');

    if (filters?.topic) {
      query.andWhere('channel.topic = :topic', { topic: filters.topic });
    }
    if (filters?.channelType) {
      query.andWhere('channel.channelType = :channelType', {
        channelType: filters.channelType,
      });
    }
    if (filters?.isActive !== undefined) {
      query.andWhere('channel.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    return query.orderBy('channel.title', 'ASC').getMany();
  }

  async findOne(id: string): Promise<Channel> {
    const channel = await this.channelsRepository.findOne({ where: { id } });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  async update(id: string, dto: UpdateChannelDto): Promise<Channel> {
    const channel = await this.findOne(id);
    Object.assign(channel, dto);
    return this.channelsRepository.save(channel);
  }

  async remove(id: string): Promise<void> {
    const channel = await this.findOne(id);
    channel.isActive = false;
    await this.channelsRepository.save(channel);
  }

  async refreshMetadata(id: string): Promise<Channel> {
    const channel = await this.findOne(id);
    return channel;
  }
}
