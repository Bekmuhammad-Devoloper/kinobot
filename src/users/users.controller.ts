import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private resolveBotId(botIdQ: string): number {
    const botId = parseInt(botIdQ || '0');
    if (!botId) throw new BadRequestException('bot query param required');
    return botId;
  }

  @Get('stats')
  async getStats(@Query('bot') botIdQ: string, @Query('telegramId') telegramId: string) {
    const botId = this.resolveBotId(botIdQ);
    const stats = await this.usersService.getUserStats(botId, parseInt(telegramId));
    return { success: true, data: stats };
  }

  @Get(':telegramId/views')
  async getUserViews(@Query('bot') botIdQ: string, @Param('telegramId') telegramId: string) {
    const botId = this.resolveBotId(botIdQ);
    const views = await this.usersService.getUserViews(botId, parseInt(telegramId));
    return { success: true, data: views };
  }
}
