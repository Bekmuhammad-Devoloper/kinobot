import { Controller, Get, Param, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { TelegramService } from './telegram.service';

@Controller('photo')
export class PhotoProxyController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('user/:telegramId')
  @Header('Cache-Control', 'public, max-age=3600')
  async getUserPhoto(
    @Param('telegramId') telegramId: string,
    @Res() res: Response,
  ) {
    try {
      const photoBuffer = await this.telegramService.getUserPhotoBuffer(parseInt(telegramId));
      
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
    @Res() res: Response,
  ) {
    try {
      // channelId @ bilan boshlanmasa, @ qo'shamiz
      let formattedChannelId = channelId;
      if (!channelId.startsWith('@') && !channelId.startsWith('-')) {
        formattedChannelId = '@' + channelId;
      }
      
      console.log('Getting channel photo for:', formattedChannelId);
      const photoBuffer = await this.telegramService.getChannelPhotoBuffer(formattedChannelId);
      
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
    @Res() res: Response,
  ) {
    try {
      const photoBuffer = await this.telegramService.getFileBuffer(fileId);
      
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
