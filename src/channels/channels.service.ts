import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from '../database/entities';
import { CreateChannelDto, UpdateChannelDto } from './dto';
import { BotManagerService } from '../bots/bot-manager.service';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel) private readonly channelRepo: Repository<Channel>,
    private readonly botManager: BotManagerService,
  ) {}

  async findAll(botId: number): Promise<Channel[]> {
    return this.channelRepo.find({ where: { bot_id: botId }, order: { created_at: 'DESC' } });
  }

  async findActive(botId: number): Promise<Channel[]> {
    return this.channelRepo.find({
      where: { is_active: true, bot_id: botId },
      order: { created_at: 'DESC' },
    });
  }

  async findById(botId: number, id: number): Promise<Channel | null> {
    return this.channelRepo.findOne({ where: { id, bot_id: botId } });
  }

  async findByChannelId(botId: number, channelId: string): Promise<Channel | null> {
    return this.channelRepo.findOne({ where: { channel_id: channelId, bot_id: botId } });
  }

  async create(botId: number, dto: CreateChannelDto): Promise<Channel> {
    // Telegram'dan kanal ma'lumotlarini avto-tortib olamiz (avatar, nom, invite link)
    const enriched = { ...dto } as Partial<Channel>;

    const tg = this.botManager.getTelegraf(botId);
    if (tg && dto.channel_id) {
      try {
        const cid = this.normalizeChatId(dto.channel_id);
        const chat: any = await tg.telegram.getChat(cid);

        if (chat?.title) enriched.channel_title = enriched.channel_title || chat.title;
        if (chat?.username) enriched.channel_username = enriched.channel_username || chat.username;
        if (chat?.photo?.big_file_id) enriched.photo_file_id = chat.photo.big_file_id;

        // Agar kanal yopiq (username yo'q) va invite_link berilmagan bo'lsa,
        // bot orqali avto invite link yaratamiz.
        if (!enriched.invite_link && !chat?.username) {
          try {
            const link = await tg.telegram.createChatInviteLink(cid, {
              name: 'Kinobot obuna',
              creates_join_request: false,
            } as any);
            if (link?.invite_link) enriched.invite_link = link.invite_link;
          } catch (e) {
            // Bot adminlik huquqi yo'q bo'lsa yoki getChat'dan link bor bo'lsa
            if ((chat as any)?.invite_link) {
              enriched.invite_link = (chat as any).invite_link;
            }
          }
        }
      } catch (e) {
        console.error(`Failed to enrich channel ${dto.channel_id}:`, e?.message || e);
      }
    }

    const channel = this.channelRepo.create({ ...enriched, bot_id: botId });
    return this.channelRepo.save(channel);
  }

  async update(botId: number, id: number, dto: UpdateChannelDto): Promise<Channel> {
    await this.channelRepo.update({ id, bot_id: botId }, dto);
    return this.channelRepo.findOne({ where: { id, bot_id: botId } });
  }

  async delete(botId: number, id: number): Promise<void> {
    await this.channelRepo.delete({ id, bot_id: botId });
  }

  async toggleActive(botId: number, id: number): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ where: { id, bot_id: botId } });
    if (channel) {
      channel.is_active = !channel.is_active;
      await this.channelRepo.save(channel);
    }
    return channel;
  }

  // Telegram API uchun chat ID ni to'g'ri formatlash:
  // "-1002478148711" -> -1002478148711 (number)
  // "@channelname" -> "@channelname"
  // "channelname" -> "@channelname"
  private normalizeChatId(channelId: string): string | number {
    const s = channelId.trim();
    if (/^-?\d+$/.test(s)) return parseInt(s);
    if (s.startsWith('@')) return s;
    return '@' + s;
  }
}
