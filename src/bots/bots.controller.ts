import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { BotsService } from './bots.service';
import { CreateBotDto, UpdateBotDto, ExtendLicenseDto } from './dto';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Controller('super-admin/bots')
@UseGuards(SuperAdminGuard)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get()
  async list() {
    const bots = await this.botsService.findAll();
    return { success: true, data: bots.map(b => this.botsService.toPublic(b)) };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const bot = await this.botsService.findById(parseInt(id));
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Post()
  async create(@Body() dto: CreateBotDto) {
    const bot = await this.botsService.create(dto);
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBotDto) {
    const bot = await this.botsService.update(parseInt(id), dto);
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Post(':id/extend')
  async extend(@Param('id') id: string, @Body() dto: ExtendLicenseDto) {
    const bot = await this.botsService.extendLicense(parseInt(id), dto);
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Patch(':id/active')
  async setActive(@Param('id') id: string, @Body() body: { is_active: boolean }) {
    const bot = await this.botsService.setActive(parseInt(id), body.is_active);
    return { success: true, data: this.botsService.toPublic(bot) };
  }

  @Post(':id/restart')
  async restart(@Param('id') id: string) {
    await this.botsService.restart(parseInt(id));
    return { success: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.botsService.delete(parseInt(id));
    return { success: true };
  }
}
