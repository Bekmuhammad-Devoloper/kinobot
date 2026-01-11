import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin, User, Movie, Channel, UserView, BotSettings } from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, User, Movie, Channel, UserView, BotSettings]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
