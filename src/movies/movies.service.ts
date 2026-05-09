import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie, UserView } from '../database/entities';
import { CreateMovieDto, UpdateMovieDto } from './dto';

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie) private readonly movieRepo: Repository<Movie>,
    @InjectRepository(UserView) private readonly userViewRepo: Repository<UserView>,
  ) {}

  async findAll(botId: number, page: number = 1, limit: number = 10): Promise<{ movies: Movie[]; total: number; pages: number }> {
    const [movies, total] = await this.movieRepo.findAndCount({
      where: { bot_id: botId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { movies, total, pages: Math.ceil(total / limit) };
  }

  async findById(botId: number, id: number): Promise<Movie | null> {
    return this.movieRepo.findOne({ where: { id, bot_id: botId } });
  }

  async findByCode(botId: number, code: string): Promise<Movie | null> {
    return this.movieRepo.findOne({ where: { code: code.toUpperCase(), bot_id: botId } });
  }

  async findPremiere(botId: number): Promise<Movie[]> {
    return this.movieRepo.find({
      where: { is_premiere: true, bot_id: botId },
      order: { premiere_order: 'ASC' },
    });
  }

  async create(botId: number, dto: CreateMovieDto): Promise<Movie> {
    const movie = this.movieRepo.create({
      ...dto,
      bot_id: botId,
      code: dto.code.toUpperCase(),
    });
    return this.movieRepo.save(movie);
  }

  async update(botId: number, id: number, dto: UpdateMovieDto): Promise<Movie> {
    if (dto.code) {
      dto.code = dto.code.toUpperCase();
    }
    await this.movieRepo.update({ id, bot_id: botId }, dto);
    return this.movieRepo.findOne({ where: { id, bot_id: botId } });
  }

  async delete(botId: number, id: number): Promise<void> {
    await this.userViewRepo.delete({ movie_id: id, bot_id: botId });
    await this.movieRepo.delete({ id, bot_id: botId });
  }

  async setPremiere(botId: number, id: number, isPremiere: boolean, order?: number): Promise<void> {
    const updateData: Partial<Movie> = { is_premiere: isPremiere };
    if (order !== undefined) {
      updateData.premiere_order = order;
    } else if (isPremiere) {
      const count = await this.movieRepo.count({ where: { is_premiere: true, bot_id: botId } });
      updateData.premiere_order = count;
    }
    await this.movieRepo.update({ id, bot_id: botId }, updateData);
  }

  async recordView(botId: number, movieId: number, userId: number): Promise<void> {
    const existingView = await this.userViewRepo.findOne({
      where: { user_id: userId, movie_id: movieId, bot_id: botId },
    });

    if (!existingView) {
      const view = this.userViewRepo.create({
        bot_id: botId,
        user_id: userId,
        movie_id: movieId,
      });
      await this.userViewRepo.save(view);
      await this.movieRepo.increment({ id: movieId, bot_id: botId }, 'views_count', 1);
    }
  }

  async getTopMovies(botId: number, limit: number = 10): Promise<Movie[]> {
    return this.movieRepo.find({
      where: { bot_id: botId },
      order: { views_count: 'DESC' },
      take: limit,
    });
  }
}
