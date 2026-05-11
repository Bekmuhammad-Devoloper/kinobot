import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AdminService } from './admin.service';
import { MoviesService } from '../movies/movies.service';
import { UsersService } from '../users/users.service';
import { ChannelsService } from '../channels/channels.service';
import { TelegramService } from '../telegram/telegram.service';
import { BotManagerService } from '../bots/bot-manager.service';
import { CreateMovieDto, UpdateMovieDto, SetPremiereDto } from '../movies/dto';
import { CreateChannelDto, UpdateChannelDto } from '../channels/dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly moviesService: MoviesService,
    private readonly usersService: UsersService,
    private readonly channelsService: ChannelsService,
    private readonly telegramService: TelegramService,
    private readonly botManager: BotManagerService,
    private readonly configService: ConfigService,
  ) {}

  // Super admin tokeni bilan kirilganda telegram ID ni aniqlash
  private resolveSuperAdminId(adminTokenHeader: string | undefined): number | null {
    if (!adminTokenHeader) return null;
    const login = this.configService.get<string>('SUPER_ADMIN_LOGIN');
    const password = this.configService.get<string>('SUPER_ADMIN_PASSWORD');
    if (!login || !password) return null;
    const expected = createHash('sha256').update(`${login}:${password}`).digest('hex');
    if (adminTokenHeader !== expected) return null;
    const saId = this.configService.get<string>('SUPER_ADMIN_TELEGRAM_ID');
    return saId ? parseInt(saId) : null;
  }

  private async resolveContext(
    telegramIdHeader: string,
    botIdHeader: string,
    botIdQuery?: string,
    adminTokenHeader?: string,
  ): Promise<{ botId: number; telegramId: number }> {
    let telegramId = parseInt(telegramIdHeader || '0');
    const botId = parseInt(botIdHeader || botIdQuery || '0');

    // Super admin tokeni orqali kirilsa, telegram ID ni o'rnatamiz
    if (!telegramId) {
      const superId = this.resolveSuperAdminId(adminTokenHeader);
      if (superId) telegramId = superId;
    }

    if (!telegramId) throw new UnauthorizedException('x-telegram-id yoki x-admin-token kerak');
    if (!botId) throw new BadRequestException('x-bot-id kerak');
    const allowed = await this.adminService.isAdmin(botId, telegramId);
    if (!allowed) throw new UnauthorizedException('Admin access required');
    return { botId, telegramId };
  }

  // ========== DASHBOARD ==========
  @Get('stats/dashboard')
  async getDashboard(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const stats = await this.adminService.getDashboardStats(botId);
    return { success: true, data: stats };
  }

  @Get('stats/movies')
  async getMovieStats(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const stats = await this.adminService.getMovieStats(botId);
    return { success: true, data: stats };
  }

  @Get('stats/activity')
  async getUserActivity(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const activity = await this.adminService.getUserActivity(botId);
    return { success: true, data: activity };
  }

  // ========== MOVIES ==========
  @Get('movies')
  async getMovies(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const result = await this.moviesService.findAll(botId, parseInt(page), parseInt(limit));
    return { success: true, data: result };
  }

  @Get('movies/:id')
  async getMovie(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Param('id') id: string,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const movie = await this.moviesService.findById(botId, parseInt(id));
    return { success: true, data: movie };
  }

  @Post('movies')
  async createMovie(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Body() dto: CreateMovieDto,
  ) {
    const { botId, telegramId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    dto.uploaded_by = telegramId;
    const movie = await this.moviesService.create(botId, dto);
    return { success: true, data: movie };
  }

  @Put('movies/:id')
  async updateMovie(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Param('id') id: string,
    @Body() dto: UpdateMovieDto,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const movie = await this.moviesService.update(botId, parseInt(id), dto);
    return { success: true, data: movie };
  }

  @Delete('movies/:id')
  async deleteMovie(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Param('id') id: string,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    await this.moviesService.delete(botId, parseInt(id));
    return { success: true };
  }

  @Patch('movies/:id/premiere')
  async setMoviePremiere(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Param('id') id: string,
    @Body() dto: SetPremiereDto,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    await this.moviesService.setPremiere(botId, parseInt(id), dto.is_premiere, dto.order);
    return { success: true };
  }

  // ========== CHANNELS ==========
  @Get('channels')
  async getChannels(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const tg = this.botManager.getTelegraf(botId);
    const channels = tg
      ? await this.telegramService.getAllChannelsWithDetails(botId, tg)
      : await this.channelsService.findAll(botId);
    return { success: true, data: channels };
  }

  @Post('channels')
  async createChannel(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Body() dto: CreateChannelDto,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const channel = await this.channelsService.create(botId, dto);
    return { success: true, data: channel };
  }

  @Patch('channels/:id')
  async patchChannel(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const channel = await this.channelsService.update(botId, parseInt(id), dto);
    return { success: true, data: channel };
  }

  @Put('channels/:id')
  async updateChannel(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const channel = await this.channelsService.update(botId, parseInt(id), dto);
    return { success: true, data: channel };
  }

  @Delete('channels/:id')
  async deleteChannel(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Param('id') id: string,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    await this.channelsService.delete(botId, parseInt(id));
    return { success: true };
  }

  // ========== USERS ==========
  @Get('users')
  async getUsers(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('filter') filter: 'all' | 'subscribed' | 'unsubscribed' = 'all',
    @Query('search') search?: string,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const result = await this.usersService.findAll(botId, parseInt(page), parseInt(limit), filter, search);
    return { success: true, data: result };
  }

  @Patch('users/:id/ban')
  async banUser(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Param('id') id: string,
    @Body() dto: { isBanned: boolean },
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    await this.usersService.setBanned(botId, parseInt(id), dto.isBanned);
    return { success: true };
  }

  @Get('users/:telegramId/views')
  async getUserViews(
    @Headers('x-telegram-id') tgId: string,
    @Headers('x-bot-id') botIdH: string,
    @Headers('x-admin-token') adminToken: string,
    @Query('bot') botIdQ: string,
    @Param('telegramId') userTelegramId: string,
  ) {
    const { botId } = await this.resolveContext(tgId, botIdH, botIdQ, adminToken);
    const views = await this.usersService.getUserViews(botId, parseInt(userTelegramId));
    return { success: true, data: views };
  }
}
