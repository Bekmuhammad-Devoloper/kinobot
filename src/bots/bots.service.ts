import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot as BotEntity } from '../database/entities';
import { CreateBotDto, UpdateBotDto, ExtendLicenseDto } from './dto';
import { BotManagerService } from './bot-manager.service';

@Injectable()
export class BotsService {
  constructor(
    @InjectRepository(BotEntity) private readonly botRepo: Repository<BotEntity>,
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
      expires_at: expiresAt,
      is_active: true,
      notes: dto.notes || null,
    });
    const saved = await this.botRepo.save(bot);

    // Launch
    await this.botManager.startBot(saved).catch((e) => {
      console.error(`Failed to start newly created bot ${saved.id}:`, e);
    });

    return saved;
  }

  async update(id: number, dto: UpdateBotDto): Promise<BotEntity> {
    const bot = await this.findById(id);
    const tokenChanged = dto.token && dto.token !== bot.token;

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
    return {
      id: bot.id,
      name: bot.name,
      username: bot.username,
      token_masked: this.maskToken(bot.token),
      owner_telegram_id: bot.owner_telegram_id,
      expires_at: bot.expires_at,
      is_active: bot.is_active,
      is_expired: new Date() > new Date(bot.expires_at),
      days_left: Math.max(0, Math.ceil((new Date(bot.expires_at).getTime() - Date.now()) / 86400000)),
      notes: bot.notes,
      created_at: bot.created_at,
    };
  }
}
