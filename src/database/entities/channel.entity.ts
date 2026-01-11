import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('required_channels')
export class Channel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  channel_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  channel_username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  channel_title: string;

  @Column({ type: 'text', nullable: true })
  invite_link: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
