import { Controller, Get, Post, Put, Delete, Patch, Body, Param } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto, UpdateChannelDto } from './dto';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  async getAll() {
    const channels = await this.channelsService.findAll();
    return { success: true, data: channels };
  }

  @Get('active')
  async getActive() {
    const channels = await this.channelsService.findActive();
    return { success: true, data: channels };
  }

  @Post()
  async create(@Body() dto: CreateChannelDto) {
    const channel = await this.channelsService.create(dto);
    return { success: true, data: channel };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    const channel = await this.channelsService.update(parseInt(id), dto);
    return { success: true, data: channel };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.channelsService.delete(parseInt(id));
    return { success: true };
  }

  @Patch(':id/toggle')
  async toggleActive(@Param('id') id: string) {
    const channel = await this.channelsService.toggleActive(parseInt(id));
    return { success: true, data: channel };
  }
}
