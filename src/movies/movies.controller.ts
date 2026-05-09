import { Controller, Get, Post, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { MoviesService } from './movies.service';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  private resolveBotId(botIdQ: string): number {
    const botId = parseInt(botIdQ || '0');
    if (!botId) throw new BadRequestException('bot query param required');
    return botId;
  }

  @Get('premiere')
  async getPremiere(@Query('bot') botIdQ: string) {
    const botId = this.resolveBotId(botIdQ);
    const movies = await this.moviesService.findPremiere(botId);
    return { success: true, data: movies };
  }

  @Get('by-code/:code')
  async getByCode(@Query('bot') botIdQ: string, @Param('code') code: string) {
    const botId = this.resolveBotId(botIdQ);
    const movie = await this.moviesService.findByCode(botId, code);
    if (!movie) return { success: false, message: 'Movie not found' };
    return { success: true, data: movie };
  }

  @Post(':id/view')
  async recordView(
    @Query('bot') botIdQ: string,
    @Param('id') id: string,
    @Body('userId') userId: number,
  ) {
    const botId = this.resolveBotId(botIdQ);
    await this.moviesService.recordView(botId, parseInt(id), userId);
    return { success: true };
  }

  @Get('top')
  async getTopMovies(@Query('bot') botIdQ: string, @Query('limit') limit: string = '10') {
    const botId = this.resolveBotId(botIdQ);
    const movies = await this.moviesService.getTopMovies(botId, parseInt(limit));
    return { success: true, data: movies };
  }
}
