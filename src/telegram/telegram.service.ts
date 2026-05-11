import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telegraf, Context } from 'telegraf';
import axios from 'axios';
import { User, Admin, Movie, Channel, UserView, Bot as BotEntity } from '../database/entities';

export interface MovieSessionData extends Partial<Movie> {
  auto_thumbnail_file_id?: string;
}

export interface SessionData {
  scene?: string;
  step?: number;
  movieData?: MovieSessionData;
  channelData?: Partial<Channel>;
  editMovieId?: number;
  editMovieData?: Partial<Movie>;
}

export interface BotContext extends Context {
  session: SessionData;
  botId: number;
  botToken: string;
}

@Injectable()
export class TelegramService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Movie) private readonly movieRepo: Repository<Movie>,
    @InjectRepository(Channel) private readonly channelRepo: Repository<Channel>,
    @InjectRepository(UserView) private readonly userViewRepo: Repository<UserView>,
    @InjectRepository(BotEntity) private readonly botRepo: Repository<BotEntity>,
  ) {}

  // ============ FILE / PHOTO HELPERS (require Telegraf instance) ============

  async getUserPhotoBuffer(tg: Telegraf, telegramId: number): Promise<Buffer | null> {
    try {
      const photos = await tg.telegram.getUserProfilePhotos(telegramId, 0, 1);
      if (photos.total_count > 0 && photos.photos[0]?.length > 0) {
        const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
        const fileLink = await tg.telegram.getFileLink(fileId);
        const response = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
      }
    } catch (error) {
      console.error('Error getting user photo buffer:', error);
    }
    return null;
  }

  async getChannelPhotoBuffer(tg: Telegraf, channelId: string | number): Promise<Buffer | null> {
    try {
      const chat = await tg.telegram.getChat(channelId as any);
      if ((chat as any).photo) {
        const fileLink = await tg.telegram.getFileLink((chat as any).photo.big_file_id);
        const response = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
      }
    } catch (error) {
      console.error('Error getting channel photo buffer:', error?.message || error);
    }
    return null;
  }

  async getFileBuffer(tg: Telegraf, fileId: string): Promise<Buffer | null> {
    try {
      const fileLink = await tg.telegram.getFileLink(fileId);
      const response = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error getting file buffer:', error);
    }
    return null;
  }

  async getChannelPhotoUrlViaProxy(channelId: string): Promise<string> {
    const safe = encodeURIComponent(channelId);
    return `/api/photo/channel/${safe}`;
  }

  // ============ USER METHODS ============

  async findOrCreateUser(botId: number, telegramId: number, username?: string, fullName?: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { bot_id: botId, telegram_id: telegramId } });

    if (!user) {
      user = this.userRepo.create({
        bot_id: botId,
        telegram_id: telegramId,
        username: username || null,
        full_name: fullName || null,
      });
      await this.userRepo.save(user);

      const activeChannels = await this.getActiveChannels(botId);
      for (const channel of activeChannels) {
        await this.incrementChannelBotUsers(botId, channel.channel_id);
      }
    } else {
      let changed = false;
      if (username !== undefined && user.username !== username) { user.username = username; changed = true; }
      if (fullName !== undefined && user.full_name !== fullName) { user.full_name = fullName; changed = true; }
      if (changed) {
        user.updated_at = new Date();
        await this.userRepo.save(user);
      }
    }

    return user;
  }

  async getAllUsers(botId: number, page: number = 1, limit: number = 10): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.userRepo.findAndCount({
      where: { bot_id: botId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { users, total };
  }

  async getUserStats(botId: number, telegramId: number): Promise<{ viewsCount: number; lastView: Date | null }> {
    const views = await this.userViewRepo.find({
      where: { bot_id: botId, user_id: telegramId },
      order: { viewed_at: 'DESC' },
    });

    return {
      viewsCount: views.length,
      lastView: views.length > 0 ? views[0].viewed_at : null,
    };
  }

  // ============ ADMIN METHODS ============

  async isAdmin(botId: number, telegramId: number): Promise<boolean> {
    // Owner of the bot is always admin
    const bot = await this.botRepo.findOne({ where: { id: botId } });
    if (bot && Number(bot.owner_telegram_id) === Number(telegramId)) return true;

    const admin = await this.adminRepo.findOne({ where: { bot_id: botId, telegram_id: telegramId } });
    return !!admin;
  }

  async findOrCreateAdmin(botId: number, telegramId: number, username?: string, fullName?: string): Promise<Admin | null> {
    const bot = await this.botRepo.findOne({ where: { id: botId } });
    if (!bot || Number(bot.owner_telegram_id) !== Number(telegramId)) {
      // Only the owner is auto-promoted
      const existing = await this.adminRepo.findOne({ where: { bot_id: botId, telegram_id: telegramId } });
      return existing || null;
    }

    let admin = await this.adminRepo.findOne({ where: { bot_id: botId, telegram_id: telegramId } });

    if (!admin) {
      admin = this.adminRepo.create({
        bot_id: botId,
        telegram_id: telegramId,
        username: username || null,
        full_name: fullName || null,
      });
      await this.adminRepo.save(admin);
    }

    return admin;
  }

  // ============ CHANNEL METHODS ============

  async getActiveChannels(botId: number): Promise<Channel[]> {
    return this.channelRepo.find({ where: { bot_id: botId, is_active: true } });
  }

  async getAllChannelsWithDetails(botId: number, tg: Telegraf): Promise<Channel[]> {
    const channels = await this.channelRepo.find({ where: { bot_id: botId }, order: { created_at: 'DESC' } });
    const totalUsers = await this.userRepo.count({ where: { bot_id: botId } });

    for (const channel of channels) {
      try {
        const chat = await tg.telegram.getChat(channel.channel_id);
        if ('title' in chat) {
          channel.channel_title = chat.title;
        }
        if (channel.bot_users_count !== totalUsers) {
          channel.bot_users_count = totalUsers;
          await this.channelRepo.update(channel.id, { bot_users_count: totalUsers });
        }
      } catch (error) {
        console.error(`Error getting channel details for ${channel.channel_id}:`, error);
      }
    }

    return channels;
  }

  async addChannel(botId: number, channelData: Partial<Channel>): Promise<Channel> {
    const channel = this.channelRepo.create({ ...channelData, bot_id: botId });
    return this.channelRepo.save(channel);
  }

  async removeChannel(botId: number, channelId: string): Promise<void> {
    await this.channelRepo.delete({ bot_id: botId, channel_id: channelId });
  }

  async incrementChannelBotUsers(botId: number, channelId: string): Promise<void> {
    await this.channelRepo.increment({ bot_id: botId, channel_id: channelId }, 'bot_users_count', 1);
  }

  async checkUserSubscription(botId: number, tg: Telegraf, telegramId: number): Promise<{ subscribed: boolean; unsubscribedChannels: Channel[] }> {
    const channels = await this.getActiveChannels(botId);
    if (channels.length === 0) {
      return { subscribed: true, unsubscribedChannels: [] };
    }

    // Bot uchun "tekshirib bo'ladigan" kanallar — bot a'zo bo'lib obunani tekshira oladi.
    // Bot kira olmaydigan kanallar foydalanuvchini bloklatmaydi (sukut bilan o'tkaziladi).
    let verifiableUnsubscribed = 0;
    let verifiableTotal = 0;

    const VALID_STATUS = ['member', 'administrator', 'creator', 'restricted'];

    for (const channel of channels) {
      try {
        // Telegram API uchun chat ID ni to'g'ri formatga keltirish.
        // Raqamli ID ("-100...") number bo'lishi kerak.
        const cid: any = /^-?\d+$/.test(channel.channel_id)
          ? parseInt(channel.channel_id)
          : channel.channel_id;

        const member = await tg.telegram.getChatMember(cid, telegramId);
        verifiableTotal++;
        if (!VALID_STATUS.includes(member.status)) {
          verifiableUnsubscribed++;
        }
      } catch (error) {
        // Bot kanalga ulanaolmasa (bot kanalda emas, kanal o'chirilgan, va h.k.)
        // — bu kanal foydalanuvchini bloklatmasin. Sukut bilan o'tkaziladi.
        console.warn(
          `Subscription check skipped for channel ${channel.channel_id}: ${error?.message || error}`,
        );
      }
    }

    // User obuna deb hisoblanadi: agar barcha verifiable kanallarga obuna bo'lsa.
    // Verifiable kanal yo'q bo'lsa — bot tekshira olmaydi va foydalanuvchini bloklamaymiz.
    const subscribed = verifiableUnsubscribed === 0;

    await this.userRepo.update(
      { bot_id: botId, telegram_id: telegramId },
      { is_subscribed: subscribed, last_subscription_check: new Date() }
    );

    // Display uchun: agar obuna bo'lmagan bo'lsa, BARCHA aktiv kanallarni ko'rsatamiz
    // (shu jumladan bot kira olmaydigan kanallar — foydalanuvchi obuna bo'lishi uchun).
    return {
      subscribed,
      unsubscribedChannels: subscribed ? [] : channels,
    };
  }

  // ============ MOVIE METHODS ============

  async getMovieByCode(botId: number, code: string): Promise<Movie | null> {
    return this.movieRepo.findOne({ where: { bot_id: botId, code: code.toUpperCase() } });
  }

  async getPremiereMovies(botId: number): Promise<Movie[]> {
    return this.movieRepo.find({
      where: { bot_id: botId, is_premiere: true },
      order: { premiere_order: 'ASC' },
    });
  }

  async getAllMovies(botId: number, page: number = 1, limit: number = 10): Promise<{ movies: Movie[]; total: number }> {
    const [movies, total] = await this.movieRepo.findAndCount({
      where: { bot_id: botId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { movies, total };
  }

  async createMovie(botId: number, movieData: Partial<Movie>): Promise<Movie> {
    movieData.code = movieData.code.toUpperCase();
    const movie = this.movieRepo.create({ ...movieData, bot_id: botId });
    return this.movieRepo.save(movie);
  }

  async updateMovie(botId: number, id: number, movieData: Partial<Movie>): Promise<Movie> {
    await this.movieRepo.update({ id, bot_id: botId }, movieData);
    return this.movieRepo.findOne({ where: { id, bot_id: botId } });
  }

  async deleteMovie(botId: number, id: number): Promise<void> {
    await this.userViewRepo.delete({ bot_id: botId, movie_id: id });
    await this.movieRepo.delete({ id, bot_id: botId });
  }

  async incrementMovieViews(botId: number, movieId: number, userId: number): Promise<void> {
    const existingView = await this.userViewRepo.findOne({
      where: { bot_id: botId, user_id: userId, movie_id: movieId },
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

  async setMoviePremiere(botId: number, movieId: number, isPremiere: boolean, order?: number): Promise<void> {
    const updateData: Partial<Movie> = { is_premiere: isPremiere };
    if (order !== undefined) {
      updateData.premiere_order = order;
    }
    await this.movieRepo.update({ id: movieId, bot_id: botId }, updateData);
  }

  // ============ STATISTICS METHODS ============

  async getDashboardStats(botId: number): Promise<{
    totalUsers: number;
    subscribedUsers: number;
    totalMovies: number;
    premiereMovies: number;
    totalViews: number;
    todayNewUsers: number;
  }> {
    const totalUsers = await this.userRepo.count({ where: { bot_id: botId } });
    const subscribedUsers = await this.userRepo.count({ where: { bot_id: botId, is_subscribed: true } });
    const totalMovies = await this.movieRepo.count({ where: { bot_id: botId } });
    const premiereMovies = await this.movieRepo.count({ where: { bot_id: botId, is_premiere: true } });

    const viewsResult = await this.movieRepo
      .createQueryBuilder('movie')
      .select('SUM(movie.views_count)', 'total')
      .where('movie.bot_id = :botId', { botId })
      .getRawOne();
    const totalViews = parseInt(viewsResult?.total || '0');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayNewUsers = await this.userRepo
      .createQueryBuilder('user')
      .where('user.bot_id = :botId', { botId })
      .andWhere('user.created_at >= :today', { today })
      .getCount();

    return {
      totalUsers,
      subscribedUsers,
      totalMovies,
      premiereMovies,
      totalViews,
      todayNewUsers,
    };
  }

  async getTopMovies(botId: number, limit: number = 10): Promise<Movie[]> {
    return this.movieRepo.find({
      where: { bot_id: botId },
      order: { views_count: 'DESC' },
      take: limit,
    });
  }

  async getMovieById(botId: number, id: number): Promise<Movie | null> {
    return this.movieRepo.findOne({ where: { id, bot_id: botId } });
  }

  async getMovieStats(botId: number, movieId: number): Promise<{
    id: number;
    title: string;
    code: string;
    totalViews: number;
    uniqueViewers: number;
    todayViews: number;
    weeklyViews: number;
    lastViewedAt: Date | null;
    createdAt: Date;
  } | null> {
    const movie = await this.movieRepo.findOne({ where: { id: movieId, bot_id: botId } });
    if (!movie) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const uniqueViewers = await this.userViewRepo
      .createQueryBuilder('view')
      .where('view.bot_id = :botId AND view.movie_id = :movieId', { botId, movieId })
      .select('COUNT(DISTINCT view.user_id)', 'count')
      .getRawOne();

    const todayViews = await this.userViewRepo
      .createQueryBuilder('view')
      .where('view.bot_id = :botId AND view.movie_id = :movieId', { botId, movieId })
      .andWhere('view.viewed_at >= :today', { today })
      .getCount();

    const weeklyViews = await this.userViewRepo
      .createQueryBuilder('view')
      .where('view.bot_id = :botId AND view.movie_id = :movieId', { botId, movieId })
      .andWhere('view.viewed_at >= :weekAgo', { weekAgo })
      .getCount();

    const lastView = await this.userViewRepo.findOne({
      where: { bot_id: botId, movie_id: movieId },
      order: { viewed_at: 'DESC' },
    });

    return {
      id: movie.id,
      title: movie.title,
      code: movie.code,
      totalViews: movie.views_count,
      uniqueViewers: parseInt(uniqueViewers?.count || '0'),
      todayViews,
      weeklyViews,
      lastViewedAt: lastView?.viewed_at || null,
      createdAt: movie.created_at,
    };
  }
}
