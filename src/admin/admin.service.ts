import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Admin, Movie, User, UserView, Channel } from '../database/entities';

@Injectable()
export class AdminService {
  private adminIds: number[];

  constructor(
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Movie) private readonly movieRepo: Repository<Movie>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserView) private readonly userViewRepo: Repository<UserView>,
    @InjectRepository(Channel) private readonly channelRepo: Repository<Channel>,
    private readonly configService: ConfigService,
  ) {
    const adminIdsStr = this.configService.get('ADMIN_IDS', '');
    this.adminIds = adminIdsStr.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
  }

  isAdmin(telegramId: number): boolean {
    return this.adminIds.includes(telegramId);
  }

  async getDashboardStats(): Promise<{
    totalUsers: number;
    subscribedUsers: number;
    totalMovies: number;
    premiereMovies: number;
    totalViews: number;
    todayUsers: number;
    todayViews: number;
    totalChannels: number;
  }> {
    const totalUsers = await this.userRepo.count();
    const subscribedUsers = await this.userRepo.count({ where: { is_subscribed: true } });
    const totalMovies = await this.movieRepo.count();
    const premiereMovies = await this.movieRepo.count({ where: { is_premiere: true } });
    const totalChannels = await this.channelRepo.count();

    const viewsResult = await this.movieRepo
      .createQueryBuilder('movie')
      .select('SUM(movie.views_count)', 'total')
      .getRawOne();
    const totalViews = parseInt(viewsResult?.total || '0');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsers = await this.userRepo
      .createQueryBuilder('user')
      .where('user.created_at >= :today', { today })
      .getCount();
    
    const todayViews = await this.userViewRepo
      .createQueryBuilder('view')
      .where('view.viewed_at >= :today', { today })
      .getCount();

    return {
      totalUsers,
      subscribedUsers,
      totalMovies,
      premiereMovies,
      totalViews,
      todayUsers,
      todayViews,
      totalChannels,
    };
  }

  async getMovieStats(): Promise<{
    topMovies: Movie[];
    weeklyViews: { date: string; count: number }[];
  }> {
    const topMovies = await this.movieRepo.find({
      order: { views_count: 'DESC' },
      take: 10,
    });

    // Weekly views
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyViewsRaw = await this.userViewRepo
      .createQueryBuilder('view')
      .select("DATE(view.viewed_at)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('view.viewed_at >= :weekAgo', { weekAgo })
      .groupBy("DATE(view.viewed_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    const weeklyViews = weeklyViewsRaw.map((item: any) => ({
      date: item.date,
      count: parseInt(item.count),
    }));

    return { topMovies, weeklyViews };
  }

  async getUserActivity(): Promise<{ date: string; newUsers: number }[]> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activityRaw = await this.userRepo
      .createQueryBuilder('user')
      .select("DATE(user.created_at)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('user.created_at >= :weekAgo', { weekAgo })
      .groupBy("DATE(user.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return activityRaw.map((item: any) => ({
      date: item.date,
      newUsers: parseInt(item.count),
    }));
  }
}
