import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Admin, Movie, User, Channel, UserView } from '../database/entities';
import { MoviesModule } from '../movies/movies.module';
import { UsersModule } from '../users/users.module';
import { ChannelsModule } from '../channels/channels.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, Movie, User, Channel, UserView]),
    MoviesModule,
    UsersModule,
    ChannelsModule,
    forwardRef(() => TelegramModule),
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
