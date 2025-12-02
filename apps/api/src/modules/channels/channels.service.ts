import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from '../../database/entities/channel.entity';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel)
    private channelsRepository: Repository<Channel>,
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
    
    const existing = await this.channelsRepository.findOne({ where: { username } });
    if (existing) {
      throw new ConflictException('Channel already exists');
    }
    
    const channel = this.channelsRepository.create({
      username,
      telegramId: '0',
      title: username,
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
      query.andWhere('channel.channelType = :channelType', { channelType: filters.channelType });
    }
    if (filters?.isActive !== undefined) {
      query.andWhere('channel.isActive = :isActive', { isActive: filters.isActive });
    }
    
    return query
      .orderBy('channel.title', 'ASC')
      .getMany();
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
