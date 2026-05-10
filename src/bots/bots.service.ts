import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot as BotEntity, User, Movie, Channel, UserView } from '../database/entities';
import { CreateBotDto, UpdateBotDto, ExtendLicenseDto } from './dto';
import { BotManagerService } from './bot-manager.service';

@Injectable()
export class BotsService {
  constructor(
    @InjectRepository(BotEntity) private readonly botRepo: Repository<BotEntity>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Movie) private readonly movieRepo: Repository<Movie>,
    @InjectRepository(Channel) private readonly channelRepo: Repository<Channel>,
    @InjectRepository(UserView) private readonly userViewRepo: Repository<UserView>,
    private readonly botManager: BotManagerService,
  ) {}

  async findAll(): Promise<BotEntity[]> {
    return this.botRepo.find({ order: { id: 'ASC' } });
  }

  async findById(id: number): Promise<BotEntity> {
    const bot = await this.botRepo.findOne({ where: { id } });
    if (!bot) throw new NotFoundException('Bot topilmadi');
    return bot;
  }

  async create(dto: CreateBotDto): Promise<BotEntity> {
    const existing = await this.botRepo.findOne({ where: { token: dto.token } });
    if (existing) throw new BadRequestException('Bu token bilan bot mavjud');

    const days = dto.duration_days ?? 31;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const bot = this.botRepo.create({
      token: dto.token,
      name: dto.name,
      owner_telegram_id: dto.owner_telegram_id,
      owner_username: this.normalizeUsername(dto.owner_username),
      owner_full_name: dto.owner_full_name || null,
      expires_at: expiresAt,
      is_active: true,
      notes: dto.notes || null,
    });
    const saved = await this.botRepo.save(bot);

    // Launch (avatar va meta avtomatik yuklanadi)
    await this.botManager.startBot(saved).catch((e) => {
      console.error(`Failed to start newly created bot ${saved.id}:`, e);
    });

    return saved;
  }

  private normalizeUsername(u?: string | null): string | null {
    if (!u) return null;
    const trimmed = u.trim().replace(/^@/, '');
    return trimmed || null;
  }

  async update(id: number, dto: UpdateBotDto): Promise<BotEntity> {
    const bot = await this.findById(id);
    const tokenChanged = dto.token && dto.token !== bot.token;

    if (dto.owner_username !== undefined) {
      dto.owner_username = this.normalizeUsername(dto.owner_username) as any;
    }

    Object.assign(bot, dto);
    const saved = await this.botRepo.save(bot);

    if (tokenChanged) {
      await this.botManager.restartBot(id);
    }

    return saved;
  }

  async extendLicense(id: number, dto: ExtendLicenseDto): Promise<BotEntity> {
    const bot = await this.findById(id);
    const base = new Date(bot.expires_at) > new Date() ? new Date(bot.expires_at) : new Date();
    base.setDate(base.getDate() + dto.days);
    bot.expires_at = base;
    return this.botRepo.save(bot);
  }

  async setActive(id: number, isActive: boolean): Promise<BotEntity> {
    const bot = await this.findById(id);
    bot.is_active = isActive;
    return this.botRepo.save(bot);
  }

  async delete(id: number): Promise<void> {
    await this.botManager.stopBot(id);
    await this.botRepo.delete(id);
  }

  async restart(id: number): Promise<void> {
    await this.botManager.restartBot(id);
  }

  // For displaying — mask the token
  maskToken(token: string): string {
    if (!token) return '';
    if (token.length < 12) return '****';
    return token.substring(0, 6) + '****' + token.substring(token.length - 4);
  }

  toPublic(bot: BotEntity) {
    const now = Date.now();
    const expiresAt = new Date(bot.expires_at).getTime();
    const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / 86400000));
    const isExpired = now > expiresAt;
    const running = !!this.botManager.getTelegraf(bot.id);

    let status: 'active' | 'expired' | 'paused' | 'starting' | 'offline' = 'active';
    if (!bot.is_active) status = 'paused';
    else if (isExpired) status = 'expired';
    else if (!running) status = 'offline';

    return {
      id: bot.id,
      name: bot.name,
      username: bot.username,
      token_masked: this.maskToken(bot.token),
      photo_url: `/api/photo/bot/${bot.id}`,
      owner_telegram_id: bot.owner_telegram_id ? String(bot.owner_telegram_id) : null,
      owner_username: bot.owner_username,
      owner_full_name: bot.owner_full_name,
      description: bot.description,
      expires_at: bot.expires_at,
      is_active: bot.is_active,
      is_expired: isExpired,
      is_running: running,
      status,
      days_left: daysLeft,
      notes: bot.notes,
      created_at: bot.created_at,
    };
  }

  // ===== PER-BOT STATS =====

  async getBotDetails(id: number) {
    const bot = await this.findById(id);

    const [usersTotal, usersToday, moviesTotal, moviesPremiere, channelsTotal, channelsActive, viewsTotal, viewsToday, lastMovie, lastUser, lastView] = await Promise.all([
      this.userRepo.count({ where: { bot_id: id } }),
      this.userRepo
        .createQueryBuilder('u')
        .where('u.bot_id = :id', { id })
        .andWhere("u.created_at >= NOW() - INTERVAL '1 day'")
        .getCount(),
      this.movieRepo.count({ where: { bot_id: id } }),
      this.movieRepo.count({ where: { bot_id: id, is_premiere: true } }),
      this.channelRepo.count({ where: { bot_id: id } }),
      this.channelRepo.count({ where: { bot_id: id, is_active: true } }),
      this.movieRepo
        .createQueryBuilder('m')
        .select('COALESCE(SUM(m.views_count), 0)', 'total')
        .where('m.bot_id = :id', { id })
        .getRawOne()
        .then((r) => parseInt(r?.total || '0')),
      this.userViewRepo
        .createQueryBuilder('v')
        .where('v.bot_id = :id', { id })
        .andWhere("v.viewed_at >= NOW() - INTERVAL '1 day'")
        .getCount(),
      this.movieRepo.findOne({ where: { bot_id: id }, order: { created_at: 'DESC' } }),
      this.userRepo.findOne({ where: { bot_id: id }, order: { created_at: 'DESC' } }),
      this.userViewRepo.findOne({ where: { bot_id: id }, order: { viewed_at: 'DESC' } }),
    ]);

    const lastActivity = [lastMovie?.created_at, lastUser?.created_at, lastView?.viewed_at]
      .filter(Boolean)
      .map((d) => new Date(d as Date).getTime())
      .sort((a, b) => b - a)[0];

    return {
      bot: this.toPublic(bot),
      counts: {
        users_total: usersTotal,
        users_today: usersToday,
        movies_total: moviesTotal,
        movies_premiere: moviesPremiere,
        channels_total: channelsTotal,
        channels_active: channelsActive,
        views_total: viewsTotal,
        views_today: viewsToday,
      },
      last_movie: lastMovie
        ? {
            id: lastMovie.id,
            code: lastMovie.code,
            title: lastMovie.title,
            file_type: lastMovie.file_type,
            views_count: lastMovie.views_count,
            is_premiere: lastMovie.is_premiere,
            created_at: lastMovie.created_at,
          }
        : null,
      last_user: lastUser
        ? {
            id: lastUser.id,
            telegram_id: String(lastUser.telegram_id),
            username: lastUser.username,
            full_name: lastUser.full_name,
            created_at: lastUser.created_at,
          }
        : null,
      last_activity: lastActivity ? new Date(lastActivity).toISOString() : null,
    };
  }

  async getBotMovies(id: number, limit = 10) {
    const movies = await this.movieRepo.find({
      where: { bot_id: id },
      order: { created_at: 'DESC' },
      take: limit,
    });
    return movies.map((m) => ({
      id: m.id,
      code: m.code,
      title: m.title,
      description: m.description,
      file_type: m.file_type,
      duration: m.duration,
      file_size: m.file_size ? Number(m.file_size) : null,
      views_count: m.views_count,
      is_premiere: m.is_premiere,
      thumbnail_file_id: m.thumbnail_file_id,
      created_at: m.created_at,
    }));
  }

  async getBotUsers(id: number, limit = 20) {
    const users = await this.userRepo.find({
      where: { bot_id: id },
      order: { created_at: 'DESC' },
      take: limit,
    });
    return users.map((u) => ({
      id: u.id,
      telegram_id: String(u.telegram_id),
      username: u.username,
      full_name: u.full_name,
      is_subscribed: u.is_subscribed,
      is_banned: u.is_banned,
      created_at: u.created_at,
    }));
  }

  async getBotChannels(id: number) {
    return this.channelRepo.find({
      where: { bot_id: id },
      order: { created_at: 'DESC' },
    });
  }

  // Aggregated stats across all bots
  async getOverviewStats() {
    const allBots = await this.botRepo.find();
    const now = Date.now();

    const totals = {
      bots_total: allBots.length,
      bots_active: 0,
      bots_paused: 0,
      bots_expired: 0,
      bots_running: 0,
      expiring_soon: 0, // 7 kun ichida tugaydigan
    };

    for (const b of allBots) {
      const expiresAt = new Date(b.expires_at).getTime();
      const expired = now > expiresAt;
      const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / 86400000));

      if (!b.is_active) totals.bots_paused++;
      else if (expired) totals.bots_expired++;
      else totals.bots_active++;

      if (this.botManager.getTelegraf(b.id)) totals.bots_running++;
      if (b.is_active && !expired && daysLeft <= 7) totals.expiring_soon++;
    }

    const [usersAll, moviesAll, viewsAll] = await Promise.all([
      this.userRepo.count(),
      this.movieRepo.count(),
      this.movieRepo
        .createQueryBuilder('m')
        .select('COALESCE(SUM(m.views_count), 0)', 'total')
        .getRawOne()
        .then((r) => parseInt(r?.total || '0')),
    ]);

    return {
      ...totals,
      users_all: usersAll,
      movies_all: moviesAll,
      views_all: viewsAll,
    };
  }
}
