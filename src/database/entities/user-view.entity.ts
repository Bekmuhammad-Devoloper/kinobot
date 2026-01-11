import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { Movie } from './movie.entity';

@Entity('user_views')
@Unique(['user_id', 'movie_id'])
export class UserView {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint' })
  user_id: number;

  @Column({ type: 'integer' })
  movie_id: number;

  @CreateDateColumn()
  viewed_at: Date;

  @ManyToOne(() => User, (user) => user.views)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'telegram_id' })
  user: User;

  @ManyToOne(() => Movie, (movie) => movie.views)
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;
}
