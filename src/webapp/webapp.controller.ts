import { Controller, Get, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { WebappService } from './webapp.service';
import { MoviesService } from '../movies/movies.service';

@Controller('webapp')
export class WebappController {
  constructor(
    private readonly webappService: WebappService,
    private readonly moviesService: MoviesService,
  ) {}

  @Post('validate')
  async validateInitData(@Body('initData') initData: string) {
    const result = this.webappService.validateTelegramWebAppData(initData);
    if (!result.valid) {
      throw new UnauthorizedException('Invalid init data');
    }
    return { success: true, data: result.data };
  }

  @Get('premiere')
  async getPremiereMovies() {
    const movies = await this.moviesService.findPremiere();
    return {
      success: true,
      data: movies.map(movie => ({
        id: movie.id,
        code: movie.code,
        title: movie.title,
        description: movie.description,
        thumbnailFileId: movie.thumbnail_file_id ? `/photo/thumbnail/${movie.thumbnail_file_id}` : null,
        viewsCount: movie.views_count,
        duration: movie.duration,
      })),
    };
  }
}
