import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { CreateMovieDto, UpdateMovieDto, SetPremiereDto } from './dto';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get('premiere')
  async getPremiere() {
    const movies = await this.moviesService.findPremiere();
    return { success: true, data: movies };
  }

  @Get('by-code/:code')
  async getByCode(@Param('code') code: string) {
    const movie = await this.moviesService.findByCode(code);
    if (!movie) {
      return { success: false, message: 'Movie not found' };
    }
    return { success: true, data: movie };
  }

  @Post(':id/view')
  async recordView(@Param('id') id: string, @Body('userId') userId: number) {
    await this.moviesService.recordView(parseInt(id), userId);
    return { success: true };
  }

  @Get('top')
  async getTopMovies(@Query('limit') limit: string = '10') {
    const movies = await this.moviesService.getTopMovies(parseInt(limit));
    return { success: true, data: movies };
  }
}
