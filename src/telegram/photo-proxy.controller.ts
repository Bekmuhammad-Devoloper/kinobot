import { Controller, Get, Param, Query, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot as BotEntity } from '../database/entities';
import { TelegramService } from './telegram.service';
import { BotManagerService } from '../bots/bot-manager.service';

@Controller('photo')
export class PhotoProxyController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly botManager: BotManagerService,
    @InjectRepository(BotEntity) private readonly botRepo: Repository<BotEntity>,
  ) {}

  @Get('bot/:botId')
  @Header('Cache-Control', 'public, max-age=3600')
  async getBotPhoto(
    @Param('botId') botId: string,
    @Res() res: Response,
  ) {
    try {
      const id = parseInt(botId);
      const bot = await this.botRepo.findOne({ where: { id } });
      if (!bot) return res.status(404).json({ error: 'Bot topilmadi' });

      const tg = this.botManager.getTelegraf(id);
      if (!tg) return res.status(503).json({ error: 'Bot offline' });

      // Saqlangan photo_file_id bor bo'lsa, undan yuklaymiz
      if (bot.photo_file_id) {
        const buf = await this.telegramService.getFileBuffer(tg, bot.photo_file_id);
        if (buf) {
          res.set('Content-Type', 'image/jpeg');
          return res.send(buf);
        }
      }

      // Aks holda getChat orqali tortib olamiz
      if (bot.username) {
        const buf = await this.telegramService.getChannelPhotoBuffer(tg, `@${bot.username}`);
        if (buf) {
          res.set('Content-Type', 'image/jpeg');
          return res.send(buf);
        }
      }

      res.status(404).json({ error: 'Photo not found' });
    } catch (error) {
      console.error('Error getting bot photo:', error);
      res.status(500).json({ error: 'Failed to get photo' });
    }
  }

  private resolveTg(botIdStr?: string) {
    const botId = botIdStr ? parseInt(botIdStr) : undefined;
    if (botId) {
      return this.botManager.getTelegraf(botId);
    }
    // Fallback to first available bot
    for (const id of (this.botManager as any).bots.keys()) {
      return this.botManager.getTelegraf(id);
    }
    return undefined;
  }

  @Get('user/:telegramId')
  @Header('Cache-Control', 'public, max-age=3600')
  async getUserPhoto(
    @Param('telegramId') telegramId: string,
    @Query('bot') botId: string,
    @Res() res: Response,
  ) {
    try {
      const tg = this.resolveTg(botId);
      if (!tg) return res.status(404).json({ error: 'Bot unavailable' });
      const photoBuffer = await this.telegramService.getUserPhotoBuffer(tg, parseInt(telegramId));
      if (photoBuffer) {
        res.set('Content-Type', 'image/jpeg');
        res.send(photoBuffer);
      } else {
        res.status(404).json({ error: 'Photo not found' });
      }
    } catch (error) {
      console.error('Error getting user photo:', error);
      res.status(500).json({ error: 'Failed to get photo' });
    }
  }

  @Get('channel/:channelId')
  @Header('Cache-Control', 'public, max-age=3600')
  async getChannelPhoto(
    @Param('channelId') channelId: string,
    @Query('bot') botId: string,
    @Res() res: Response,
  ) {
    try {
      let formatted = channelId;
      if (!channelId.startsWith('@') && !channelId.startsWith('-')) {
        formatted = '@' + channelId;
      }
      const tg = this.resolveTg(botId);
      if (!tg) return res.status(404).json({ error: 'Bot unavailable' });
      const photoBuffer = await this.telegramService.getChannelPhotoBuffer(tg, formatted);
      if (photoBuffer) {
        res.set('Content-Type', 'image/jpeg');
        res.send(photoBuffer);
      } else {
        res.status(404).json({ error: 'Photo not found' });
      }
    } catch (error) {
      console.error('Error getting channel photo:', error);
      res.status(500).json({ error: 'Failed to get photo' });
    }
  }

  @Get('thumbnail/:fileId')
  @Header('Cache-Control', 'public, max-age=86400')
  async getThumbnail(
    @Param('fileId') fileId: string,
    @Query('bot') botId: string,
    @Res() res: Response,
  ) {
    try {
      const tg = this.resolveTg(botId);
      if (!tg) return res.status(404).json({ error: 'Bot unavailable' });
      const photoBuffer = await this.telegramService.getFileBuffer(tg, fileId);
      if (photoBuffer) {
        res.set('Content-Type', 'image/jpeg');
        res.send(photoBuffer);
      } else {
        res.status(404).json({ error: 'Thumbnail not found' });
      }
    } catch (error) {
      console.error('Error getting thumbnail:', error);
      res.status(500).json({ error: 'Failed to get thumbnail' });
    }
  }
}
