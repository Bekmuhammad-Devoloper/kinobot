import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Index } from 'typeorm';

@Entity('admins')
@Unique(['bot_id', 'telegram_id'])
export class Admin {
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

  @CreateDateColumn()
  created_at: Date;
}
