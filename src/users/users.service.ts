import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserView } from '../database/entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserView) private readonly userViewRepo: Repository<UserView>,
  ) {}

  async findAll(
    botId: number,
    page: number = 1,
    limit: number = 10,
    filter?: 'all' | 'subscribed' | 'unsubscribed',
    search?: string,
  ): Promise<{ users: User[]; total: number; pages: number }> {
    const queryBuilder = this.userRepo.createQueryBuilder('user')
      .where('user.bot_id = :botId', { botId });

    if (filter === 'subscribed') {
      queryBuilder.andWhere('user.is_subscribed = :subscribed', { subscribed: true });
    } else if (filter === 'unsubscribed') {
      queryBuilder.andWhere('user.is_subscribed = :subscribed', { subscribed: false });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.username ILIKE :search OR user.full_name ILIKE :search OR CAST(user.telegram_id AS TEXT) LIKE :search)',
        { search: `%${search}%` }
      );
    }

    queryBuilder
      .orderBy('user.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();
    return { users, total, pages: Math.ceil(total / limit) };
  }

  async findByTelegramId(botId: number, telegramId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { telegram_id: telegramId, bot_id: botId } });
  }

  async getUserViews(botId: number, telegramId: number): Promise<UserView[]> {
    return this.userViewRepo.find({
      where: { user_id: telegramId, bot_id: botId },
      relations: ['movie'],
      order: { viewed_at: 'DESC' },
    });
  }

  async getUserStats(botId: number, telegramId: number): Promise<{
    viewsCount: number;
    lastView: Date | null;
  }> {
    const views = await this.userViewRepo.find({
      where: { user_id: telegramId, bot_id: botId },
      order: { viewed_at: 'DESC' },
    });

    return {
      viewsCount: views.length,
      lastView: views.length > 0 ? views[0].viewed_at : null,
    };
  }

  async getTotalCount(botId: number): Promise<number> {
    return this.userRepo.count({ where: { bot_id: botId } });
  }

  async getSubscribedCount(botId: number): Promise<number> {
    return this.userRepo.count({ where: { bot_id: botId, is_subscribed: true } });
  }

  async getTodayNewUsersCount(botId: number): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.userRepo
      .createQueryBuilder('user')
      .where('user.bot_id = :botId', { botId })
      .andWhere('user.created_at >= :today', { today })
      .getCount();
  }

  async setBanned(botId: number, id: number, isBanned: boolean): Promise<void> {
    await this.userRepo.update({ id, bot_id: botId }, { is_banned: isBanned });
  }

  async findById(botId: number, id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id, bot_id: botId } });
  }
}
