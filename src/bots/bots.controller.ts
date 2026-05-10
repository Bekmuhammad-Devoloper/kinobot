import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BotsService } from './bots.service';
import { SystemInfoService } from './system-info.service';
import { CreateBotDto, UpdateBotDto, ExtendLicenseDto } from './dto';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Controller('super-admin')
@UseGuards(SuperAdminGuard)
export class BotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly systemInfo: SystemInfoService,
  ) {}

  @Get('overview')
  async overview() {
    const stats = await this.botsService.getOverviewStats();
    return { success: true, data: stats };
  }

  @Get('system')
  async system() {
    const stats = await this.systemInfo.getSystemStats();
    return { success: true, data: stats };
  }

  @Get('bots')
  async list() {
    const bots = await this.botsService.findAll();
    return { success: true, data: bots.map((b) => this.botsService.toPublic(b)) };
  }

  @Get('bots/:id/details')
  async details(@Param('id') id: string) {
    const data = await this.botsService.getBotDetails(parseInt(id));
    return { success: true, data };
  }

  @Get('bots/:id/movies')
  async movies(@Param('id') id: string, @Query('limit') limit?: string) {
    const data = await this.botsService.getBotMovies(parseInt(id), parseInt(limit || '10'));
    return { success: true, data };
  }

  @Get('bots/:id/users')
  async users(@Param('id') id: string, @Query('limit') limit?: string) {
    const data = await this.botsService.getBotUsers(parseInt(id), parseInt(limit || '20'));
    return { success: true, data };
  }

  @Get('bots/:id/channels')
  async channels(@Param('id') id: string) {
    const data = await this.botsService.getBotChannels(parseInt(id));
    return { success: true, data };
  }

  @Get('bots/:id')
  async getOne(@Param('id') id: string) {
    const bot = await this.botsService.findById(parseInt(id));
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Post('bots')
  async create(@Body() dto: CreateBotDto) {
    const bot = await this.botsService.create(dto);
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Put('bots/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateBotDto) {
    const bot = await this.botsService.update(parseInt(id), dto);
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Post('bots/:id/extend')
  async extend(@Param('id') id: string, @Body() dto: ExtendLicenseDto) {
    const bot = await this.botsService.extendLicense(parseInt(id), dto);
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Patch('bots/:id/active')
  async setActive(@Param('id') id: string, @Body() body: { is_active: boolean }) {
    const bot = await this.botsService.setActive(parseInt(id), body.is_active);
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Post('bots/:id/restart')
  async restart(@Param('id') id: string) {
    await this.botsService.restart(parseInt(id));
    return { success: true };
  }

  @Delete('bots/:id')
  async remove(@Param('id') id: string) {
    await this.botsService.delete(parseInt(id));
    return { success: true };
  }
}
