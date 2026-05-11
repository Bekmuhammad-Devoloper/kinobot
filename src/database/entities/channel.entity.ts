import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Index } from 'typeorm';

@Entity('required_channels')
@Unique(['bot_id', 'channel_id'])
export class Channel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  @Index()
  bot_id: number;

  @Column({ type: 'varchar', length: 255 })
  channel_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  channel_username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  channel_title: string;

  @Column({ type: 'text', nullable: true })
  invite_link: string;

  @Column({ type: 'text', nullable: true })
  photo_url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photo_file_id: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  bot_users_count: number;

  @CreateDateColumn()
  created_at: Date;
}
