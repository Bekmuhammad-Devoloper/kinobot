import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from '../database/entities';
import { CreateChannelDto, UpdateChannelDto } from './dto';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel) private readonly channelRepo: Repository<Channel>,
  ) {}

  async findAll(): Promise<Channel[]> {
    return this.channelRepo.find({ order: { created_at: 'DESC' } });
  }

  async findActive(): Promise<Channel[]> {
    return this.channelRepo.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: number): Promise<Channel | null> {
    return this.channelRepo.findOne({ where: { id } });
  }

  async findByChannelId(channelId: string): Promise<Channel | null> {
    return this.channelRepo.findOne({ where: { channel_id: channelId } });
  }

  async create(dto: CreateChannelDto): Promise<Channel> {
    const channel = this.channelRepo.create(dto);
    return this.channelRepo.save(channel);
  }

  async update(id: number, dto: UpdateChannelDto): Promise<Channel> {
    await this.channelRepo.update(id, dto);
    return this.channelRepo.findOne({ where: { id } });
  }

  async delete(id: number): Promise<void> {
    await this.channelRepo.delete(id);
  }

  async toggleActive(id: number): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ where: { id } });
    if (channel) {
      channel.is_active = !channel.is_active;
      await this.channelRepo.save(channel);
    }
    return channel;
  }
}
