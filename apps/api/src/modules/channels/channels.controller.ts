import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { ChannelsService } from './channels.service';

@ApiTags('Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search public Telegram channels' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 400, description: 'Invalid query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async search(@CurrentUser('sub') userId: string, @Query('q') query: string) {
    if (!query) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    const channels = await this.channelsService.searchPublicChannels(userId, query);
    return {
      channels,
      total: channels.length,
    };
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get user\'s joined channels' })
  @ApiResponse({ status: 200, description: 'User subscriptions retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSubscriptions(@CurrentUser('sub') userId: string) {
    const channels = await this.channelsService.getUserSubscriptions(userId);
    return {
      channels,
      total: channels.length,
    };
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get channel by username' })
  @ApiResponse({ status: 200, description: 'Channel retrieved' })
  @ApiResponse({ status: 400, description: 'Invalid username or not a channel' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getByUsername(
    @CurrentUser('sub') userId: string,
    @Param('username') username: string,
  ) {
    return this.channelsService.getChannelByUsername(userId, username);
  }
}
