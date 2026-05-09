import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index } from 'typeorm';

@Entity('users')
@Unique(['bot_id', 'telegram_id'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  @Index()
  bot_id: number;

  @Column({ type: 'bigint' })
  telegram_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  photo_url: string;

  @Column({ type: 'boolean', default: false })
  is_subscribed: boolean;

  @Column({ type: 'boolean', default: false })
  is_banned: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_subscription_check: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
