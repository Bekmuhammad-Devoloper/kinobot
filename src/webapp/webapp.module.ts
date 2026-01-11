import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { WebappController } from './webapp.controller';
import { WebappService } from './webapp.service';
import { MoviesModule } from '../movies/movies.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'),
      serveRoot: '/webapp',
    }),
    MoviesModule,
  ],
  controllers: [WebappController],
  providers: [WebappService],
})
export class WebappModule {}
