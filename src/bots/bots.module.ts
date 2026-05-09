import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bot as BotEntity } from '../database/entities';
import { BotManagerService } from './bot-manager.service';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';
import { SuperAdminAuthController } from './super-admin-auth.controller';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BotEntity]),
    forwardRef(() => TelegramModule),
  ],
  providers: [BotManagerService, BotsService],
  controllers: [BotsController, SuperAdminAuthController],
  exports: [BotManagerService, BotsService],
})
export class BotsModule {}
