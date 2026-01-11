import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Admin } from './admin.entity';
import { UserView } from './user-view.entity';

@Entity('movies')
export class Movie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500 })
  file_id: string;

  @Column({ type: 'varchar', length: 20, default: 'video' })
  file_type: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnail_file_id: string;

  @Column({ type: 'integer', nullable: true })
  duration: number;

  @Column({ type: 'bigint', nullable: true })
  file_size: number;

  @Column({ type: 'boolean', default: false })
  is_premiere: boolean;

  @Column({ type: 'integer', default: 0 })
  premiere_order: number;

  @Column({ type: 'integer', default: 0 })
  views_count: number;

  @Column({ type: 'bigint', nullable: true })
  uploaded_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => UserView, (userView) => userView.movie)
  views: UserView[];
}
