import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto, UpdateChannelDto } from './dto';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  private resolveBotId(botIdQ: string): number {
    const botId = parseInt(botIdQ || '0');
    if (!botId) throw new BadRequestException('bot query param required');
    return botId;
  }

  @Get()
  async getAll(@Query('bot') botIdQ: string) {
    const botId = this.resolveBotId(botIdQ);
    const channels = await this.channelsService.findAll(botId);
    return { success: true, data: channels };
  }

  @Get('active')
  async getActive(@Query('bot') botIdQ: string) {
    const botId = this.resolveBotId(botIdQ);
    const channels = await this.channelsService.findActive(botId);
    return { success: true, data: channels };
  }

  @Post()
  async create(@Query('bot') botIdQ: string, @Body() dto: CreateChannelDto) {
    const botId = this.resolveBotId(botIdQ);
    const channel = await this.channelsService.create(botId, dto);
    return { success: true, data: channel };
  }

  @Put(':id')
  async update(@Query('bot') botIdQ: string, @Param('id') id: string, @Body() dto: UpdateChannelDto) {
    const botId = this.resolveBotId(botIdQ);
    const channel = await this.channelsService.update(botId, parseInt(id), dto);
    return { success: true, data: channel };
  }

  @Delete(':id')
  async delete(@Query('bot') botIdQ: string, @Param('id') id: string) {
    const botId = this.resolveBotId(botIdQ);
    await this.channelsService.delete(botId, parseInt(id));
    return { success: true };
  }

  @Patch(':id/toggle')
  async toggleActive(@Query('bot') botIdQ: string, @Param('id') id: string) {
    const botId = this.resolveBotId(botIdQ);
    const channel = await this.channelsService.toggleActive(botId, parseInt(id));
    return { success: true, data: channel };
  }
}
