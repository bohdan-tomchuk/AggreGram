import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
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

  @Get('lookup')
  @ApiOperation({ summary: 'Look up a public Telegram channel by exact username' })
  @ApiQuery({ name: 'username', description: 'Channel username (with or without @)', required: true })
  @ApiResponse({ status: 200, description: 'Channel found' })
  @ApiResponse({ status: 400, description: 'Invalid username' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async lookup(@CurrentUser('id') userId: string, @Query('username') username: string) {
    if (!username || !username.trim()) {
      throw new BadRequestException('Query parameter "username" is required');
    }

    try {
      const channel = await this.channelsService.lookupChannelByUsername(userId, username.trim());
      return { channel };
    } catch (err: any) {
      if (err?.status === 400 || err?.name === 'BadRequestException') {
        throw new NotFoundException('Channel not found');
      }
      throw err;
    }
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get user\'s joined channels' })
  @ApiResponse({ status: 200, description: 'User subscriptions retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSubscriptions(@CurrentUser('id') userId: string) {
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
    @CurrentUser('id') userId: string,
    @Param('username') username: string,
  ) {
    return this.channelsService.getChannelByUsername(userId, username);
  }
}
