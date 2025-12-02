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
