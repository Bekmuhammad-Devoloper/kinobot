import { Controller, Get, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('stats')
  async getStats(@Query('telegramId') telegramId: string) {
    const stats = await this.usersService.getUserStats(parseInt(telegramId));
    return { success: true, data: stats };
  }

  @Get(':telegramId/views')
  async getUserViews(@Param('telegramId') telegramId: string) {
    const views = await this.usersService.getUserViews(parseInt(telegramId));
    return { success: true, data: views };
  }
}
