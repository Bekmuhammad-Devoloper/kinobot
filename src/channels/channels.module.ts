import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { Channel } from '../database/entities';
import { TelegramModule } from '../telegram/telegram.module';
import { BotsModule } from '../bots/bots.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel]),
    forwardRef(() => TelegramModule),
    forwardRef(() => BotsModule),
  ],
  providers: [ChannelsService],
  controllers: [ChannelsController],
  exports: [ChannelsService],
})
export class ChannelsModule {}
