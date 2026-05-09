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

  async findAll(botId: number): Promise<Channel[]> {
    return this.channelRepo.find({ where: { bot_id: botId }, order: { created_at: 'DESC' } });
  }

  async findActive(botId: number): Promise<Channel[]> {
    return this.channelRepo.find({
      where: { is_active: true, bot_id: botId },
      order: { created_at: 'DESC' },
    });
  }

  async findById(botId: number, id: number): Promise<Channel | null> {
    return this.channelRepo.findOne({ where: { id, bot_id: botId } });
  }

  async findByChannelId(botId: number, channelId: string): Promise<Channel | null> {
    return this.channelRepo.findOne({ where: { channel_id: channelId, bot_id: botId } });
  }

  async create(botId: number, dto: CreateChannelDto): Promise<Channel> {
    const channel = this.channelRepo.create({ ...dto, bot_id: botId });
    return this.channelRepo.save(channel);
  }

  async update(botId: number, id: number, dto: UpdateChannelDto): Promise<Channel> {
    await this.channelRepo.update({ id, bot_id: botId }, dto);
    return this.channelRepo.findOne({ where: { id, bot_id: botId } });
  }

  async delete(botId: number, id: number): Promise<void> {
    await this.channelRepo.delete({ id, bot_id: botId });
  }

  async toggleActive(botId: number, id: number): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ where: { id, bot_id: botId } });
    if (channel) {
      channel.is_active = !channel.is_active;
      await this.channelRepo.save(channel);
    }
    return channel;
  }
}
