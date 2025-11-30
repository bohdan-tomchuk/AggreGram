# Task ID: 5

**Title:** Build Channel Management Module

**Status:** pending

**Dependencies:** 4

**Priority:** high

**Description:** Implement CRUD operations for channels with Telegram metadata resolution, topic assignment, channel type management, and filtering capabilities.

**Details:**

1. Create apps/api/src/modules/channels/dto/create-channel.dto.ts:
```typescript
import { IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  usernameOrLink: string;

  @IsString()
  topic: string;

  @IsEnum(['news', 'personal_blog', 'official'])
  channelType: 'news' | 'personal_blog' | 'official';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  crawlPriority?: number;
}
```

2. Create apps/api/src/modules/channels/dto/update-channel.dto.ts:
```typescript
import { IsString, IsEnum, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsEnum(['news', 'personal_blog', 'official'])
  channelType?: 'news' | 'personal_blog' | 'official';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  crawlPriority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

3. Create apps/api/src/modules/channels/channels.service.ts:
```typescript
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
    // Handle @username, t.me/username, https://t.me/username
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
    
    // Check for duplicates
    const existing = await this.channelsRepository.findOne({ where: { username } });
    if (existing) {
      throw new ConflictException('Channel already exists');
    }
    
    // TODO: Resolve channel via Telegram API (will be implemented in crawler module)
    // For now, create with placeholder data
    const channel = this.channelsRepository.create({
      username,
      telegramId: '0', // Will be updated by crawler
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
    // Soft delete
    channel.isActive = false;
    await this.channelsRepository.save(channel);
  }

  async refreshMetadata(id: string): Promise<Channel> {
    const channel = await this.findOne(id);
    // TODO: Implement Telegram API call to refresh metadata
    // This will be completed in the crawler module
    return channel;
  }
}
```

4. Create apps/api/src/modules/channels/channels.controller.ts:
```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Post()
  async create(@Body() dto: CreateChannelDto) {
    return this.channelsService.create(dto);
  }

  @Get()
  async findAll(
    @Query('topic') topic?: string,
    @Query('channelType') channelType?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.channelsService.findAll({
      topic,
      channelType,
      isActive: isActive ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.channelsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.channelsService.remove(id);
    return { message: 'Channel removed successfully' };
  }

  @Post(':id/refresh')
  async refresh(@Param('id', ParseUUIDPipe) id: string) {
    return this.channelsService.refreshMetadata(id);
  }
}
```

5. Create apps/api/src/modules/channels/channels.module.ts:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from '../../database/entities/channel.entity';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel]),
    AuthModule,
  ],
  providers: [ChannelsService],
  controllers: [ChannelsController],
  exports: [ChannelsService],
})
export class ChannelsModule {}
```

**Test Strategy:**

1. Unit tests for ChannelsService:
   - parseUsername handles @username, t.me/username, https://t.me/username
   - create throws ConflictException for duplicate usernames
   - findAll applies filters correctly
   - update modifies only provided fields
   - remove performs soft delete (sets isActive=false)
2. Integration tests for ChannelsController:
   - POST /channels creates channel with valid data
   - GET /channels returns filtered results
   - GET /channels/:id returns channel details
   - PATCH /channels/:id updates channel
   - DELETE /channels/:id soft deletes channel
   - POST /channels/:id/refresh returns channel (metadata refresh pending)
3. Test authentication guard blocks unauthenticated requests
4. Test validation with invalid DTOs (wrong enum values, invalid username format)
5. E2E test: create channel -> list channels -> update -> soft delete -> verify not in active list
