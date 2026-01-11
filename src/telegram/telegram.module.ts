import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramUpdate } from './telegram.update';
import { TelegramService } from './telegram.service';
import { User, Admin, Movie, Channel, UserView } from '../database/entities';
import { UsersModule } from '../users/users.module';
import { MoviesModule } from '../movies/movies.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Admin, Movie, Channel, UserView]),
    forwardRef(() => UsersModule),
    forwardRef(() => MoviesModule),
    forwardRef(() => ChannelsModule),
  ],
  providers: [TelegramUpdate, TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
