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

    tg.use(session() as any);

    const webAppUrl = this.configService.get('WEB_APP_URL', 'http://localhost:3000/webapp');
    const adminWebAppUrl = this.configService.get('ADMIN_WEB_APP_URL', 'http://localhost:3000/webapp/admin');

    registerBotHandlers(tg, {
      botId: bot.id,
      webAppUrl,
      adminWebAppUrl,
      contactUsername: 'Bobrr1234',
    }, this.telegramService);

    tg.catch((err, ctx) => {
      this.logger.error(`Bot ${bot.id} error: ${err}`);
    });

    // Try to fetch bot info & set username
    try {
      const me = await tg.telegram.getMe();
      if (me?.username && bot.username !== me.username) {
        await this.botRepo.update(bot.id, { username: me.username });
      }
    } catch (e) {
      this.logger.error(`Bot ${bot.id} getMe failed: ${e?.message || e}`);
    }

    // Launch in background (long polling)
    tg.launch().catch((e) => {
      this.logger.error(`Bot ${bot.id} launch failed: ${e?.message || e}`);
    });

    this.bots.set(bot.id, tg);
    this.logger.log(`✅ Bot ${bot.id} (${bot.name}) started`);
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
