import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { FeedsService } from './feeds.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { AddSourceDto } from './dto/add-source.dto';

@ApiTags('Feeds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feeds')
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new feed' })
  @ApiResponse({ status: 201, description: 'Feed created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@CurrentUser('sub') userId: string, @Body() createFeedDto: CreateFeedDto) {
    return this.feedsService.create(userId, createFeedDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all feeds for current user' })
  @ApiResponse({ status: 200, description: 'Feeds retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@CurrentUser('sub') userId: string) {
    const feeds = await this.feedsService.findAll(userId);
    return {
      feeds,
      total: feeds.length,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get feed by ID' })
  @ApiResponse({ status: 200, description: 'Feed retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.feedsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update feed' })
  @ApiResponse({ status: 200, description: 'Feed updated successfully' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() updateFeedDto: UpdateFeedDto,
  ) {
    return this.feedsService.update(userId, id, updateFeedDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete feed' })
  @ApiResponse({ status: 204, description: 'Feed deleted successfully' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async delete(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.feedsService.delete(userId, id);
  }

  @Get(':id/sources')
  @ApiOperation({ summary: 'Get all sources for a feed' })
  @ApiResponse({ status: 200, description: 'Sources retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSources(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const sources = await this.feedsService.getSources(userId, id);
    return {
      sources,
      total: sources.length,
    };
  }

  @Post(':id/sources')
  @ApiOperation({ summary: 'Add a source channel to feed' })
  @ApiResponse({ status: 201, description: 'Source added successfully' })
  @ApiResponse({ status: 400, description: 'Channel already added or not found' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addSource(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() addSourceDto: AddSourceDto,
  ) {
    return this.feedsService.addSource(userId, id, addSourceDto.channelUsername);
  }

  @Delete(':id/sources/:sourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a source from feed' })
  @ApiResponse({ status: 204, description: 'Source removed successfully' })
  @ApiResponse({ status: 404, description: 'Feed or source not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeSource(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('sourceId') sourceId: string,
  ) {
    await this.feedsService.removeSource(userId, id, sourceId);
  }

  @Post(':id/channel')
  @ApiOperation({ summary: 'Create Telegram channel for feed' })
  @ApiResponse({ status: 201, description: 'Channel creation started' })
  @ApiResponse({ status: 400, description: 'Feed not eligible for channel creation' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createChannel(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.feedsService.createChannel(userId, id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Manually trigger feed synchronization' })
  @ApiResponse({ status: 201, description: 'Sync job started' })
  @ApiResponse({ status: 400, description: 'Feed not ready for sync' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async syncFeed(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.feedsService.syncFeed(userId, id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause feed aggregation' })
  @ApiResponse({ status: 200, description: 'Feed paused successfully' })
  @ApiResponse({ status: 400, description: 'Feed cannot be paused' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async pauseFeed(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.feedsService.pauseFeed(userId, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume feed aggregation' })
  @ApiResponse({ status: 200, description: 'Feed resumed successfully' })
  @ApiResponse({ status: 400, description: 'Feed cannot be resumed' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resumeFeed(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.feedsService.resumeFeed(userId, id);
  }

  @Get(':id/jobs')
  @ApiOperation({ summary: 'Get recent aggregation jobs for feed' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getJobs(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const jobs = await this.feedsService.getJobs(userId, id);
    return {
      jobs,
      total: jobs.length,
    };
  }
}
