import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Admin, Movie, User, UserView, Channel, Bot as BotEntity } from '../database/entities';

@Injectable()
export class AdminService {
  private readonly superAdminId: number | null;

  constructor(
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Movie) private readonly movieRepo: Repository<Movie>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserView) private readonly userViewRepo: Repository<UserView>,
    @InjectRepository(Channel) private readonly channelRepo: Repository<Channel>,
    @InjectRepository(BotEntity) private readonly botRepo: Repository<BotEntity>,
    private readonly configService: ConfigService,
  ) {
    const sa = this.configService.get<string>('SUPER_ADMIN_TELEGRAM_ID');
    this.superAdminId = sa ? parseInt(sa) : null;
  }

  async isAdmin(botId: number, telegramId: number): Promise<boolean> {
    if (this.superAdminId && telegramId === this.superAdminId) return true;
    const bot = await this.botRepo.findOne({ where: { id: botId } });
    if (bot && Number(bot.owner_telegram_id) === Number(telegramId)) return true;
    const admin = await this.adminRepo.findOne({ where: { bot_id: botId, telegram_id: telegramId } });
    return !!admin;
  }

  async getDashboardStats(botId: number) {
    const totalUsers = await this.userRepo.count({ where: { bot_id: botId } });
    const subscribedUsers = await this.userRepo.count({ where: { bot_id: botId, is_subscribed: true } });
    const totalMovies = await this.movieRepo.count({ where: { bot_id: botId } });
    const premiereMovies = await this.movieRepo.count({ where: { bot_id: botId, is_premiere: true } });
    const totalChannels = await this.channelRepo.count({ where: { bot_id: botId } });

    const viewsResult = await this.movieRepo
      .createQueryBuilder('movie')
      .select('SUM(movie.views_count)', 'total')
      .where('movie.bot_id = :botId', { botId })
      .getRawOne();
    const totalViews = parseInt(viewsResult?.total || '0');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsers = await this.userRepo
      .createQueryBuilder('user')
      .where('user.bot_id = :botId', { botId })
      .andWhere('user.created_at >= :today', { today })
      .getCount();

    const todayViews = await this.userViewRepo
      .createQueryBuilder('view')
      .where('view.bot_id = :botId', { botId })
      .andWhere('view.viewed_at >= :today', { today })
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

  async getMovieStats(botId: number) {
    const topMovies = await this.movieRepo.find({
      where: { bot_id: botId },
      order: { views_count: 'DESC' },
      take: 10,
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyViewsRaw = await this.userViewRepo
      .createQueryBuilder('view')
      .select("DATE(view.viewed_at)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('view.bot_id = :botId', { botId })
      .andWhere('view.viewed_at >= :weekAgo', { weekAgo })
      .groupBy("DATE(view.viewed_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    const weeklyViews = weeklyViewsRaw.map((item: any) => ({
      date: item.date,
      count: parseInt(item.count),
    }));

    return { topMovies, weeklyViews };
  }

  async getUserActivity(botId: number) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activityRaw = await this.userRepo
      .createQueryBuilder('user')
      .select("DATE(user.created_at)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('user.bot_id = :botId', { botId })
      .andWhere('user.created_at >= :weekAgo', { weekAgo })
      .groupBy("DATE(user.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return activityRaw.map((item: any) => ({
      date: item.date,
      newUsers: parseInt(item.count),
    }));
  }
}
