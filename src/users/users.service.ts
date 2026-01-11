import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User, UserView } from '../database/entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserView) private readonly userViewRepo: Repository<UserView>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
    filter?: 'all' | 'subscribed' | 'unsubscribed',
    search?: string,
  ): Promise<{ users: User[]; total: number; pages: number }> {
    const queryBuilder = this.userRepo.createQueryBuilder('user');

    if (filter === 'subscribed') {
      queryBuilder.where('user.is_subscribed = :subscribed', { subscribed: true });
    } else if (filter === 'unsubscribed') {
      queryBuilder.where('user.is_subscribed = :subscribed', { subscribed: false });
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

  async findByTelegramId(telegramId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { telegram_id: telegramId } });
  }

  async getUserViews(telegramId: number): Promise<UserView[]> {
    return this.userViewRepo.find({
      where: { user_id: telegramId },
      relations: ['movie'],
      order: { viewed_at: 'DESC' },
    });
  }

  async getUserStats(telegramId: number): Promise<{
    viewsCount: number;
    lastView: Date | null;
  }> {
    const views = await this.userViewRepo.find({
      where: { user_id: telegramId },
      order: { viewed_at: 'DESC' },
    });

    return {
      viewsCount: views.length,
      lastView: views.length > 0 ? views[0].viewed_at : null,
    };
  }

  async getTotalCount(): Promise<number> {
    return this.userRepo.count();
  }

  async getSubscribedCount(): Promise<number> {
    return this.userRepo.count({ where: { is_subscribed: true } });
  }

  async getTodayNewUsersCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.userRepo
      .createQueryBuilder('user')
      .where('user.created_at >= :today', { today })
      .getCount();
  }

  async setBanned(id: number, isBanned: boolean): Promise<void> {
    await this.userRepo.update(id, { is_banned: isBanned });
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }
}
