import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import axios from 'axios';
import { User, Admin, Movie, Channel, UserView } from '../database/entities';

export interface SessionData {
  scene?: string;
  step?: number;
  movieData?: Partial<Movie>;
  channelData?: Partial<Channel>;
  editMovieId?: number;
  editMovieData?: Partial<Movie>;
}

export interface BotContext extends Context {
  session: SessionData;
}

@Injectable()
export class TelegramService {
  private adminIds: number[];

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Movie) private readonly movieRepo: Repository<Movie>,
    @InjectRepository(Channel) private readonly channelRepo: Repository<Channel>,
    @InjectRepository(UserView) private readonly userViewRepo: Repository<UserView>,
    private readonly configService: ConfigService,
  ) {
    const adminIdsStr = this.configService.get('ADMIN_IDS', '');
    this.adminIds = adminIdsStr.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
  }

  // ============ USER METHODS ============

  async getUserPhotoUrl(telegramId: number): Promise<string | null> {
    try {
      const photos = await this.bot.telegram.getUserProfilePhotos(telegramId, 0, 1);
      if (photos.total_count > 0 && photos.photos[0]?.length > 0) {
        const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
        const file = await this.bot.telegram.getFile(fileId);
        return `https://api.telegram.org/file/bot${this.configService.get('BOT_TOKEN')}/${file.file_path}`;
      }
    } catch (error) {
      console.error('Error getting user photo:', error);
    }
    return null;
  }

  async getUserPhotoBuffer(telegramId: number): Promise<Buffer | null> {
    try {
      const photos = await this.bot.telegram.getUserProfilePhotos(telegramId, 0, 1);
      if (photos.total_count > 0 && photos.photos[0]?.length > 0) {
        const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
        const fileLink = await this.bot.telegram.getFileLink(fileId);
        
        const response = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
      }
    } catch (error) {
      console.error('Error getting user photo buffer:', error);
    }
    return null;
  }

  async getChannelPhotoBuffer(channelId: string): Promise<Buffer | null> {
    try {
      const chat = await this.bot.telegram.getChat(channelId);
      if (chat.photo) {
        const fileLink = await this.bot.telegram.getFileLink(chat.photo.big_file_id);
        
        const response = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
      }
    } catch (error) {
      console.error('Error getting channel photo buffer:', error);
    }
    return null;
  }

  async findOrCreateUser(telegramId: number, username?: string, fullName?: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { telegram_id: telegramId } });
    const isNewUser = !user;
    
    // Get user photo
    const photoUrl = await this.getUserPhotoUrl(telegramId);
    
    if (!user) {
      user = this.userRepo.create({
        telegram_id: telegramId,
        username: username || null,
        full_name: fullName || null,
        photo_url: photoUrl,
      });
      await this.userRepo.save(user);
      
      // Increment bot_users_count for all active channels
      const activeChannels = await this.getActiveChannels();
      for (const channel of activeChannels) {
        await this.incrementChannelBotUsers(channel.channel_id);
      }
    } else {
      // Update user info if changed
      if (username !== undefined) user.username = username;
      if (fullName !== undefined) user.full_name = fullName;
      if (photoUrl) user.photo_url = photoUrl;
      user.updated_at = new Date();
      await this.userRepo.save(user);
    }
    
    return user;
  }

  async getAllUsers(page: number = 1, limit: number = 10): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.userRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { users, total };
  }

  async getUserStats(telegramId: number): Promise<{ viewsCount: number; lastView: Date | null }> {
    const views = await this.userViewRepo.find({
      where: { user_id: telegramId },
      order: { viewed_at: 'DESC' },
    });
    
    return {
      viewsCount: views.length,
      lastView: views.length > 0 ? views[0].viewed_at : null,
    };
  }

  // ============ ADMIN METHODS ============

  isAdmin(telegramId: number): boolean {
    return this.adminIds.includes(telegramId);
  }

  async findOrCreateAdmin(telegramId: number, username?: string, fullName?: string): Promise<Admin | null> {
    if (!this.isAdmin(telegramId)) return null;
    
    let admin = await this.adminRepo.findOne({ where: { telegram_id: telegramId } });
    
    if (!admin) {
      admin = this.adminRepo.create({
        telegram_id: telegramId,
        username: username || null,
        full_name: fullName || null,
      });
      await this.adminRepo.save(admin);
    }
    
    return admin;
  }

  // ============ CHANNEL METHODS ============

  async getChannelPhotoUrl(chatId: string): Promise<string | null> {
    try {
      const chat = await this.bot.telegram.getChat(chatId);
      if (chat.photo) {
        const file = await this.bot.telegram.getFile(chat.photo.big_file_id);
        return `https://api.telegram.org/file/bot${this.configService.get('BOT_TOKEN')}/${file.file_path}`;
      }
    } catch (error) {
      console.error('Error getting channel photo:', error);
    }
    return null;
  }

  async getActiveChannels(): Promise<Channel[]> {
    return this.channelRepo.find({ where: { is_active: true } });
  }

  async getAllChannelsWithDetails(): Promise<Channel[]> {
    const channels = await this.channelRepo.find({ order: { created_at: 'DESC' } });
    const totalUsers = await this.userRepo.count();
    
    // Get photo and member count for each channel
    for (const channel of channels) {
      try {
        const photoUrl = await this.getChannelPhotoUrl(channel.channel_id);
        if (photoUrl) channel.photo_url = photoUrl;
        
        const chat = await this.bot.telegram.getChat(channel.channel_id);
        if ('title' in chat) {
          channel.channel_title = chat.title;
        }
        
        // Agar bot_users_count 0 bo'lsa, mavjud userlar soniga tenglashtiramiz
        if (channel.bot_users_count === 0 && totalUsers > 0) {
          channel.bot_users_count = totalUsers;
          await this.channelRepo.update(channel.id, { bot_users_count: totalUsers });
        }
      } catch (error) {
        console.error(`Error getting channel details for ${channel.channel_id}:`, error);
      }
    }
    
    return channels;
  }

  async addChannel(channelData: Partial<Channel>): Promise<Channel> {
    // Get channel photo
    const photoUrl = await this.getChannelPhotoUrl(channelData.channel_id);
    if (photoUrl) channelData.photo_url = photoUrl;
    
    const channel = this.channelRepo.create(channelData);
    return this.channelRepo.save(channel);
  }

  async removeChannel(channelId: string): Promise<void> {
    await this.channelRepo.delete({ channel_id: channelId });
  }

  async incrementChannelBotUsers(channelId: string): Promise<void> {
    await this.channelRepo.increment({ channel_id: channelId }, 'bot_users_count', 1);
  }

  async checkUserSubscription(telegramId: number): Promise<{ subscribed: boolean; unsubscribedChannels: Channel[] }> {
    const channels = await this.getActiveChannels();
    const unsubscribedChannels: Channel[] = [];
    
    for (const channel of channels) {
      try {
        const member = await this.bot.telegram.getChatMember(channel.channel_id, telegramId);
        if (!['member', 'administrator', 'creator'].includes(member.status)) {
          unsubscribedChannels.push(channel);
        }
      } catch (error) {
        // If we can't check, assume not subscribed
        unsubscribedChannels.push(channel);
      }
    }
    
    const subscribed = unsubscribedChannels.length === 0;
    
    // Update user subscription status
    await this.userRepo.update(
      { telegram_id: telegramId },
      { is_subscribed: subscribed, last_subscription_check: new Date() }
    );
    
    return { subscribed, unsubscribedChannels };
  }

  // ============ MOVIE METHODS ============

  async getMovieByCode(code: string): Promise<Movie | null> {
    return this.movieRepo.findOne({ where: { code: code.toUpperCase() } });
  }

  async getPremiereMovies(): Promise<Movie[]> {
    return this.movieRepo.find({
      where: { is_premiere: true },
      order: { premiere_order: 'ASC' },
    });
  }

  async getAllMovies(page: number = 1, limit: number = 10): Promise<{ movies: Movie[]; total: number }> {
    const [movies, total] = await this.movieRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { movies, total };
  }

  async createMovie(movieData: Partial<Movie>): Promise<Movie> {
    movieData.code = movieData.code.toUpperCase();
    const movie = this.movieRepo.create(movieData);
    return this.movieRepo.save(movie);
  }

  async updateMovie(id: number, movieData: Partial<Movie>): Promise<Movie> {
    await this.movieRepo.update(id, movieData);
    return this.movieRepo.findOne({ where: { id } });
  }

  async deleteMovie(id: number): Promise<void> {
    await this.userViewRepo.delete({ movie_id: id });
    await this.movieRepo.delete(id);
  }

  async incrementMovieViews(movieId: number, userId: number): Promise<void> {
    // Check if user already viewed this movie
    const existingView = await this.userViewRepo.findOne({
      where: { user_id: userId, movie_id: movieId },
    });
    
    if (!existingView) {
      // Create new view record
      const view = this.userViewRepo.create({
        user_id: userId,
        movie_id: movieId,
      });
      await this.userViewRepo.save(view);
      
      // Increment views count
      await this.movieRepo.increment({ id: movieId }, 'views_count', 1);
    }
  }

  async setMoviePremiere(movieId: number, isPremiere: boolean, order?: number): Promise<void> {
    const updateData: Partial<Movie> = { is_premiere: isPremiere };
    if (order !== undefined) {
      updateData.premiere_order = order;
    }
    await this.movieRepo.update(movieId, updateData);
  }

  // ============ STATISTICS METHODS ============

  async getDashboardStats(): Promise<{
    totalUsers: number;
    subscribedUsers: number;
    totalMovies: number;
    premiereMovies: number;
    totalViews: number;
    todayNewUsers: number;
  }> {
    const totalUsers = await this.userRepo.count();
    const subscribedUsers = await this.userRepo.count({ where: { is_subscribed: true } });
    const totalMovies = await this.movieRepo.count();
    const premiereMovies = await this.movieRepo.count({ where: { is_premiere: true } });
    
    const viewsResult = await this.movieRepo
      .createQueryBuilder('movie')
      .select('SUM(movie.views_count)', 'total')
      .getRawOne();
    const totalViews = parseInt(viewsResult?.total || '0');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayNewUsers = await this.userRepo
      .createQueryBuilder('user')
      .where('user.created_at >= :today', { today })
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

  async getTopMovies(limit: number = 10): Promise<Movie[]> {
    return this.movieRepo.find({
      order: { views_count: 'DESC' },
      take: limit,
    });
  }

  // ============ ADDITIONAL MOVIE METHODS ============

  async getMovieById(id: number): Promise<Movie | null> {
    return this.movieRepo.findOne({ where: { id } });
  }

  async getMovieStats(movieId: number): Promise<{
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
    const movie = await this.movieRepo.findOne({ where: { id: movieId } });
    if (!movie) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    // Get unique viewers count
    const uniqueViewers = await this.userViewRepo
      .createQueryBuilder('view')
      .where('view.movie_id = :movieId', { movieId })
      .select('COUNT(DISTINCT view.user_id)', 'count')
      .getRawOne();

    // Get today's views
    const todayViews = await this.userViewRepo
      .createQueryBuilder('view')
      .where('view.movie_id = :movieId', { movieId })
      .andWhere('view.viewed_at >= :today', { today })
      .getCount();

    // Get weekly views
    const weeklyViews = await this.userViewRepo
      .createQueryBuilder('view')
      .where('view.movie_id = :movieId', { movieId })
      .andWhere('view.viewed_at >= :weekAgo', { weekAgo })
      .getCount();

    // Get last viewed at
    const lastView = await this.userViewRepo.findOne({
      where: { movie_id: movieId },
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
