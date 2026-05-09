import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramService } from './telegram.service';
import { PhotoProxyController } from './photo-proxy.controller';
import { Bot as BotEntity, User, Admin, Movie, Channel, UserView } from '../database/entities';
import { UsersModule } from '../users/users.module';
import { MoviesModule } from '../movies/movies.module';
import { ChannelsModule } from '../channels/channels.module';
import { BotsModule } from '../bots/bots.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BotEntity, User, Admin, Movie, Channel, UserView]),
    forwardRef(() => UsersModule),
    forwardRef(() => MoviesModule),
    forwardRef(() => ChannelsModule),
    forwardRef(() => BotsModule),
  ],
  controllers: [PhotoProxyController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
