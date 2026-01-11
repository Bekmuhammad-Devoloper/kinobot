import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule } from 'nestjs-telegraf';
import { ServeStaticModule } from '@nestjs/serve-static';
import { session } from 'telegraf';
import { join } from 'path';

import { DatabaseModule } from './database/database.module';
import { TelegramModule } from './telegram/telegram.module';
import { MoviesModule } from './movies/movies.module';
import { UsersModule } from './users/users.module';
import { ChannelsModule } from './channels/channels.module';
import { AdminModule } from './admin/admin.module';
import { WebappModule } from './webapp/webapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public', 'webapp'),
      serveRoot: '/webapp',
      serveStaticOptions: {
        index: ['index.html'],
        fallthrough: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'kino_bot'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get('TELEGRAM_BOT_TOKEN'),
        middlewares: [session()],
        include: [TelegramModule],
      }),
    }),
    DatabaseModule,
    TelegramModule,
    MoviesModule,
    UsersModule,
    ChannelsModule,
    AdminModule,
    WebappModule,
  ],
})
export class AppModule {}
