import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Movie } from './movie.entity';

@Entity('user_views')
@Unique(['bot_id', 'user_id', 'movie_id'])
export class UserView {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  @Index()
  bot_id: number;

  @Column({ type: 'bigint' })
  user_id: number;

  @Column({ type: 'integer' })
  movie_id: number;

  @CreateDateColumn()
  viewed_at: Date;

  @ManyToOne(() => Movie, (movie) => movie.views, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;
}
