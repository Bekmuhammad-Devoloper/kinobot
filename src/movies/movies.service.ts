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

  async findAll(page: number = 1, limit: number = 10): Promise<{ movies: Movie[]; total: number; pages: number }> {
    const [movies, total] = await this.movieRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { movies, total, pages: Math.ceil(total / limit) };
  }

  async findById(id: number): Promise<Movie | null> {
    return this.movieRepo.findOne({ where: { id } });
  }

  async findByCode(code: string): Promise<Movie | null> {
    return this.movieRepo.findOne({ where: { code: code.toUpperCase() } });
  }

  async findPremiere(): Promise<Movie[]> {
    return this.movieRepo.find({
      where: { is_premiere: true },
      order: { premiere_order: 'ASC' },
    });
  }

  async create(dto: CreateMovieDto): Promise<Movie> {
    const movie = this.movieRepo.create({
      ...dto,
      code: dto.code.toUpperCase(),
    });
    return this.movieRepo.save(movie);
  }

  async update(id: number, dto: UpdateMovieDto): Promise<Movie> {
    if (dto.code) {
      dto.code = dto.code.toUpperCase();
    }
    await this.movieRepo.update(id, dto);
    return this.movieRepo.findOne({ where: { id } });
  }

  async delete(id: number): Promise<void> {
    await this.userViewRepo.delete({ movie_id: id });
    await this.movieRepo.delete(id);
  }

  async setPremiere(id: number, isPremiere: boolean, order?: number): Promise<void> {
    const updateData: Partial<Movie> = { is_premiere: isPremiere };
    if (order !== undefined) {
      updateData.premiere_order = order;
    } else if (isPremiere) {
      const count = await this.movieRepo.count({ where: { is_premiere: true } });
      updateData.premiere_order = count;
    }
    await this.movieRepo.update(id, updateData);
  }

  async recordView(movieId: number, userId: number): Promise<void> {
    const existingView = await this.userViewRepo.findOne({
      where: { user_id: userId, movie_id: movieId },
    });

    if (!existingView) {
      const view = this.userViewRepo.create({
        user_id: userId,
        movie_id: movieId,
      });
      await this.userViewRepo.save(view);
      await this.movieRepo.increment({ id: movieId }, 'views_count', 1);
    }
  }

  async getTopMovies(limit: number = 10): Promise<Movie[]> {
    return this.movieRepo.find({
      order: { views_count: 'DESC' },
      take: limit,
    });
  }
}
