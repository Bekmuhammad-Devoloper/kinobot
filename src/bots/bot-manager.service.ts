import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Telegraf, session } from 'telegraf';
import { Bot as BotEntity } from '../database/entities';
import { TelegramService, BotContext } from '../telegram/telegram.service';
import { registerBotHandlers } from '../telegram/bot-handlers';

@Injectable()
export class BotManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotManagerService.name);
  private readonly bots: Map<number, Telegraf<BotContext>> = new Map();
  private licenseTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(BotEntity) private readonly botRepo: Repository<BotEntity>,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const allBots = await this.botRepo.find();
    for (const bot of allBots) {
      try {
        await this.startBot(bot);
      } catch (e) {
        this.logger.error(`Failed to start bot ${bot.id}: ${e?.message || e}`);
      }
    }

    // Periodic license check (every 60s)
    this.licenseTimer = setInterval(() => this.checkLicenses().catch(() => {}), 60_000);
  }

  async onModuleDestroy() {
    if (this.licenseTimer) clearInterval(this.licenseTimer);
    for (const [, tg] of this.bots) {
      try { tg.stop('SIGTERM'); } catch {}
    }
    this.bots.clear();
  }

  getTelegraf(botId: number): Telegraf<BotContext> | undefined {
    return this.bots.get(botId);
  }

  async startBot(bot: BotEntity) {
    if (this.bots.has(bot.id)) {
      this.logger.warn(`Bot ${bot.id} already running`);
      return;
    }

    const tg = new Telegraf<BotContext>(bot.token);

    // Identity middleware
    tg.use(async (ctx, next) => {
      (ctx as any).botId = bot.id;
      (ctx as any).botToken = bot.token;
      return next();
    });

    // License middleware (re-fetch fresh state on every update)
    tg.use(async (ctx, next) => {
      const fresh = await this.botRepo.findOne({ where: { id: bot.id } });
      if (!fresh) return;
      if (!fresh.is_active) {
        if (ctx.message || ctx.callbackQuery) {
          try { await ctx.reply('⏸ Bot vaqtinchalik to\'xtatilgan. Admin bilan bog\'laning.'); } catch {}
        }
        return;
      }
      if (new Date() > new Date(fresh.expires_at)) {
        if (ctx.message || ctx.callbackQuery) {
          try { await ctx.reply('❌ Bot litsenziyasi muddati tugagan. Iltimos, admin bilan bog\'laning.'); } catch {}
        }
        return;
      }
      return next();
    });

    // In-memory session — telegraf v4'da default session() yangi user uchun
    // ctx.session ni yaratmaydi, shuning uchun defaultSession factory beramiz.
    tg.use(session({
      defaultSession: () => ({} as any),
    }) as any);

    // Defensive fallback: agar baribir undefined bo'lsa, bo'sh obyektga aylantiramiz.
    tg.use(async (ctx, next) => {
      if (!(ctx as any).session) (ctx as any).session = {};
      return next();
    });

    const webAppUrl = this.configService.get('WEB_APP_URL', 'http://localhost:3000/webapp');
    const adminWebAppUrl = this.configService.get('ADMIN_WEB_APP_URL', 'http://localhost:3000/webapp/admin');

    registerBotHandlers(tg, {
      botId: bot.id,
      webAppUrl,
      adminWebAppUrl,
      contactUsername: 'Bobrr1234',
    }, this.telegramService);

    tg.catch((err) => {
      this.logger.error(`Bot ${bot.id} runtime error: ${err}`);
    });

    // Try to fetch bot info & set username
    try {
      const me = await tg.telegram.getMe();
      const updates: Partial<BotEntity> = {};
      if (me?.username && bot.username !== me.username) {
        updates.username = me.username;
      }

      // Bot'ning chat ma'lumotlarini olib, profil rasmini yangilaymiz
      try {
        const chat: any = await tg.telegram.getChat(`@${me.username}`);
        if (chat?.photo?.big_file_id && bot.photo_file_id !== chat.photo.big_file_id) {
          updates.photo_file_id = chat.photo.big_file_id;
        }
        if (chat?.description && bot.description !== chat.description) {
          updates.description = chat.description;
        }
      } catch {}

      // Egasining ma'lumotlarini yangilaymiz (agar telegram_id bor bo'lsa)
      if (bot.owner_telegram_id) {
        try {
          const ownerChat: any = await tg.telegram.getChat(Number(bot.owner_telegram_id));
          const fullName = [ownerChat.first_name, ownerChat.last_name].filter(Boolean).join(' ').trim();
          if (ownerChat?.username && bot.owner_username !== ownerChat.username) {
            updates.owner_username = ownerChat.username;
          }
          if (fullName && bot.owner_full_name !== fullName) {
            updates.owner_full_name = fullName;
          }
        } catch {}
      }

      if (Object.keys(updates).length > 0) {
        await this.botRepo.update(bot.id, updates);
      }
    } catch (e) {
      this.logger.error(`Bot ${bot.id} getMe failed: ${e?.message || e}`);
    }

    // Eski polling/webhook session'ini majburan tozalash (409 Conflict'ni hal qiladi)
    try {
      await tg.telegram.deleteWebhook({ drop_pending_updates: true });
    } catch (e) {
      this.logger.warn(`Bot ${bot.id} deleteWebhook warning: ${e?.message || e}`);
    }

    // Launch with retry on 409 Conflict
    this.launchWithRetry(tg, bot.id);

    this.bots.set(bot.id, tg);
    this.logger.log(`✅ Bot ${bot.id} (${bot.name}) started`);
  }

  private launchWithRetry(tg: Telegraf<BotContext>, botId: number, attempt = 1) {
    tg.launch({ dropPendingUpdates: true }).catch(async (e) => {
      const msg = e?.message || String(e);
      this.logger.error(`Bot ${botId} launch failed (attempt ${attempt}): ${msg}`);

      // 409 Conflict — boshqa instance polling qilmoqda. Eski session'ni o'ldiramiz va qayta urinamiz.
      if (msg.includes('409') && attempt < 5) {
        try {
          await tg.telegram.deleteWebhook({ drop_pending_updates: true });
          // Telegram'dan eski polling session'ini chiqarish uchun bitta getUpdates so'rovi
          await tg.telegram.callApi('getUpdates' as any, { offset: -1, timeout: 0, limit: 1 } as any).catch(() => {});
        } catch {}
        const delayMs = Math.min(2000 * attempt, 10_000);
        this.logger.log(`Bot ${botId} retrying launch in ${delayMs}ms...`);
        setTimeout(() => this.launchWithRetry(tg, botId, attempt + 1), delayMs);
      } else if (attempt >= 5) {
        this.logger.error(`Bot ${botId} gave up after ${attempt} attempts. Boshqa joyda ishlayotgan instance'ni to'xtating.`);
        this.bots.delete(botId);
      }
    });
  }

  async stopBot(botId: number) {
    const tg = this.bots.get(botId);
    if (tg) {
      try { tg.stop('SIGTERM'); } catch {}
      this.bots.delete(botId);
      this.logger.log(`🛑 Bot ${botId} stopped`);
    }
  }

  async restartBot(botId: number) {
    await this.stopBot(botId);
    const bot = await this.botRepo.findOne({ where: { id: botId } });
    if (bot) await this.startBot(bot);
  }

  async checkLicenses() {
    const allBots = await this.botRepo.find();
    for (const b of allBots) {
      const expired = new Date() > new Date(b.expires_at);
      const running = this.bots.has(b.id);
      // We keep bots running when expired - middleware blocks updates with a message.
      // If they're explicitly inactive, we still keep running (middleware blocks).
      if (b.is_active && !running) {
        try { await this.startBot(b); } catch {}
      }
    }
  }
}
