import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bot as BotEntity, User, Movie, Channel, UserView } from '../database/entities';
import { BotManagerService } from './bot-manager.service';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';
import { SuperAdminAuthController } from './super-admin-auth.controller';
import { SystemInfoService } from './system-info.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BotEntity, User, Movie, Channel, UserView]),
    forwardRef(() => TelegramModule),
  ],
  providers: [BotManagerService, BotsService, SystemInfoService],
  controllers: [BotsController, SuperAdminAuthController],
  exports: [BotManagerService, BotsService],
})
export class BotsModule {}
