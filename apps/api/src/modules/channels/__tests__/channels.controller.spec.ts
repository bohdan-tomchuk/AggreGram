import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsController } from '../channels.controller';
import { ChannelsService } from '../channels.service';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('ChannelsController', () => {
  let controller: ChannelsController;
  let service: ChannelsService;

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

  const mockChannelsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    refreshMetadata: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [
        {
          provide: ChannelsService,
          useValue: mockChannelsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ChannelsController>(ChannelsController);
    service = module.get<ChannelsService>(ChannelsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new channel', async () => {
      const dto: CreateChannelDto = {
        usernameOrLink: '@testchannel',
        topic: 'technology',
        channelType: 'news',
      };

      mockChannelsService.create.mockResolvedValue(mockChannel);

      const result = await controller.create(dto);

      expect(result).toEqual(mockChannel);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return all channels without filters', async () => {
      mockChannelsService.findAll.mockResolvedValue([mockChannel]);

      const result = await controller.findAll();

      expect(result).toEqual([mockChannel]);
      expect(service.findAll).toHaveBeenCalledWith({
        topic: undefined,
        channelType: undefined,
        isActive: undefined,
      });
    });

    it('should return filtered channels by topic', async () => {
      mockChannelsService.findAll.mockResolvedValue([mockChannel]);

      await controller.findAll('technology');

      expect(service.findAll).toHaveBeenCalledWith({
        topic: 'technology',
        channelType: undefined,
        isActive: undefined,
      });
    });

    it('should return filtered channels by channelType', async () => {
      mockChannelsService.findAll.mockResolvedValue([mockChannel]);

      await controller.findAll(undefined, 'news');

      expect(service.findAll).toHaveBeenCalledWith({
        topic: undefined,
        channelType: 'news',
        isActive: undefined,
      });
    });

    it('should return filtered channels by isActive=true', async () => {
      mockChannelsService.findAll.mockResolvedValue([mockChannel]);

      await controller.findAll(undefined, undefined, 'true');

      expect(service.findAll).toHaveBeenCalledWith({
        topic: undefined,
        channelType: undefined,
        isActive: true,
      });
    });

    it('should return filtered channels by isActive=false', async () => {
      mockChannelsService.findAll.mockResolvedValue([]);

      await controller.findAll(undefined, undefined, 'false');

      expect(service.findAll).toHaveBeenCalledWith({
        topic: undefined,
        channelType: undefined,
        isActive: false,
      });
    });

    it('should apply all filters', async () => {
      mockChannelsService.findAll.mockResolvedValue([mockChannel]);

      await controller.findAll('technology', 'news', 'true');

      expect(service.findAll).toHaveBeenCalledWith({
        topic: 'technology',
        channelType: 'news',
        isActive: true,
      });
    });
  });

  describe('findOne', () => {
    it('should return a channel by id', async () => {
      mockChannelsService.findOne.mockResolvedValue(mockChannel);

      const result = await controller.findOne('channel-id-123');

      expect(result).toEqual(mockChannel);
      expect(service.findOne).toHaveBeenCalledWith('channel-id-123');
    });
  });

  describe('update', () => {
    it('should update a channel', async () => {
      const dto: UpdateChannelDto = {
        topic: 'sports',
        crawlPriority: 8,
      };

      const updatedChannel = { ...mockChannel, ...dto };
      mockChannelsService.update.mockResolvedValue(updatedChannel);

      const result = await controller.update('channel-id-123', dto);

      expect(result).toEqual(updatedChannel);
      expect(service.update).toHaveBeenCalledWith('channel-id-123', dto);
    });
  });

  describe('remove', () => {
    it('should remove a channel', async () => {
      mockChannelsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('channel-id-123');

      expect(result).toEqual({ message: 'Channel removed successfully' });
      expect(service.remove).toHaveBeenCalledWith('channel-id-123');
    });
  });

  describe('refresh', () => {
    it('should refresh channel metadata', async () => {
      mockChannelsService.refreshMetadata.mockResolvedValue(mockChannel);

      const result = await controller.refresh('channel-id-123');

      expect(result).toEqual(mockChannel);
      expect(service.refreshMetadata).toHaveBeenCalledWith('channel-id-123');
    });
  });
});
