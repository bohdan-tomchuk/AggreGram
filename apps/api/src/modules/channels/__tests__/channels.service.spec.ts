import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ChannelsService } from '../channels.service';
import { Channel } from '../../../database/entities/channel.entity';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';

describe('ChannelsService', () => {
  let service: ChannelsService;
  let repository: Repository<Channel>;

  const mockChannel = {
    id: 'channel-id-123',
    username: 'testchannel',
    telegramId: '123456789',
    title: 'Test Channel',
    topic: 'technology',
    channelType: 'news' as const,
    crawlPriority: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        {
          provide: getRepositoryToken(Channel),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
    repository = module.get<Repository<Channel>>(getRepositoryToken(Channel));

    jest.clearAllMocks();
  });

  describe('parseUsername', () => {
    it('should parse @username format', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: '@testchannel',
        topic: 'technology',
        channelType: 'news',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockChannel);
      mockRepository.save.mockResolvedValue(mockChannel);

      const result = await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'testchannel' }),
      );
    });

    it('should parse t.me/username format', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: 't.me/testchannel',
        topic: 'technology',
        channelType: 'news',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockChannel);
      mockRepository.save.mockResolvedValue(mockChannel);

      await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'testchannel' }),
      );
    });

    it('should parse https://t.me/username format', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: 'https://t.me/testchannel',
        topic: 'technology',
        channelType: 'news',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockChannel);
      mockRepository.save.mockResolvedValue(mockChannel);

      await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'testchannel' }),
      );
    });

    it('should parse http://t.me/username format', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: 'http://t.me/testchannel',
        topic: 'technology',
        channelType: 'news',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockChannel);
      mockRepository.save.mockResolvedValue(mockChannel);

      await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'testchannel' }),
      );
    });

    it('should throw BadRequestException for invalid format', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: 'invalid-format',
        topic: 'technology',
        channelType: 'news',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Invalid channel username or link format',
      );
    });
  });

  describe('create', () => {
    it('should create channel with default priority', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: '@testchannel',
        topic: 'technology',
        channelType: 'news',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockChannel);
      mockRepository.save.mockResolvedValue(mockChannel);

      const result = await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ crawlPriority: 5 }),
      );
      expect(result).toEqual(mockChannel);
    });

    it('should create channel with custom priority', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: '@testchannel',
        topic: 'technology',
        channelType: 'news',
        crawlPriority: 8,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockChannel);
      mockRepository.save.mockResolvedValue(mockChannel);

      await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ crawlPriority: 8 }),
      );
    });

    it('should throw ConflictException for duplicate username', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: '@testchannel',
        topic: 'technology',
        channelType: 'news',
      };

      mockRepository.findOne.mockResolvedValue(mockChannel);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(
        'Channel already exists',
      );
    });

    it('should set isActive to true by default', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: '@testchannel',
        topic: 'technology',
        channelType: 'news',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockChannel);
      mockRepository.save.mockResolvedValue(mockChannel);

      await service.create(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });
  });

  describe('findAll', () => {
    const mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    beforeEach(() => {
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should return all channels without filters', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockChannel]);

      const result = await service.findAll();

      expect(result).toEqual([mockChannel]);
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'channel.title',
        'ASC',
      );
    });

    it('should filter by topic', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockChannel]);

      await service.findAll({ topic: 'technology' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'channel.topic = :topic',
        { topic: 'technology' },
      );
    });

    it('should filter by channelType', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockChannel]);

      await service.findAll({ channelType: 'news' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'channel.channelType = :channelType',
        { channelType: 'news' },
      );
    });

    it('should filter by isActive', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockChannel]);

      await service.findAll({ isActive: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'channel.isActive = :isActive',
        { isActive: true },
      );
    });

    it('should apply multiple filters', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockChannel]);

      await service.findAll({
        topic: 'technology',
        channelType: 'news',
        isActive: true,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(3);
    });
  });

  describe('findOne', () => {
    it('should return channel by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockChannel);

      const result = await service.findOne('channel-id-123');

      expect(result).toEqual(mockChannel);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'channel-id-123' },
      });
    });

    it('should throw NotFoundException if channel not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        'Channel not found',
      );
    });
  });

  describe('update', () => {
    it('should update channel with provided fields', async () => {
      const dto: UpdateChannelDto = {
        topic: 'sports',
        crawlPriority: 8,
      };

      mockRepository.findOne.mockResolvedValue(mockChannel);
      mockRepository.save.mockResolvedValue({ ...mockChannel, ...dto });

      const result = await service.update('channel-id-123', dto);

      expect(result).toEqual(expect.objectContaining(dto));
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if channel not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { topic: 'sports' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update only provided fields', async () => {
      const dto: UpdateChannelDto = {
        crawlPriority: 9,
      };

      const updatedChannel = { ...mockChannel, crawlPriority: 9 };
      mockRepository.findOne.mockResolvedValue(mockChannel);
      mockRepository.save.mockResolvedValue(updatedChannel);

      const result = await service.update('channel-id-123', dto);

      expect(result.topic).toBe(mockChannel.topic);
      expect(result.crawlPriority).toBe(9);
    });
  });

  describe('remove', () => {
    it('should perform soft delete by setting isActive to false', async () => {
      mockRepository.findOne.mockResolvedValue(mockChannel);
      mockRepository.save.mockResolvedValue({
        ...mockChannel,
        isActive: false,
      });

      await service.remove('channel-id-123');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw NotFoundException if channel not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('refreshMetadata', () => {
    it('should return channel (metadata refresh pending)', async () => {
      mockRepository.findOne.mockResolvedValue(mockChannel);

      const result = await service.refreshMetadata('channel-id-123');

      expect(result).toEqual(mockChannel);
    });

    it('should throw NotFoundException if channel not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshMetadata('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
