import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Headers, UnauthorizedException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { MoviesService } from '../movies/movies.service';
import { UsersService } from '../users/users.service';
import { ChannelsService } from '../channels/channels.service';
import { TelegramService } from '../telegram/telegram.service';
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
  ) {}

  // Validate admin (in real app, use proper auth)
  private validateAdmin(telegramId: string) {
    if (!telegramId || !this.adminService.isAdmin(parseInt(telegramId))) {
      throw new UnauthorizedException('Admin access required');
    }
  }

  // ========== DASHBOARD ==========
  @Get('stats/dashboard')
  async getDashboard(@Headers('x-telegram-id') telegramId: string) {
    this.validateAdmin(telegramId);
    const stats = await this.adminService.getDashboardStats();
    return { success: true, data: stats };
  }

  @Get('stats/movies')
  async getMovieStats(@Headers('x-telegram-id') telegramId: string) {
    this.validateAdmin(telegramId);
    const stats = await this.adminService.getMovieStats();
    return { success: true, data: stats };
  }

  @Get('stats/activity')
  async getUserActivity(@Headers('x-telegram-id') telegramId: string) {
    this.validateAdmin(telegramId);
    const activity = await this.adminService.getUserActivity();
    return { success: true, data: activity };
  }

  // ========== MOVIES ==========
  @Get('movies')
  async getMovies(
    @Headers('x-telegram-id') telegramId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    this.validateAdmin(telegramId);
    const result = await this.moviesService.findAll(parseInt(page), parseInt(limit));
    return { success: true, data: result };
  }

  @Get('movies/:id')
  async getMovie(
    @Headers('x-telegram-id') telegramId: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(telegramId);
    const movie = await this.moviesService.findById(parseInt(id));
    return { success: true, data: movie };
  }

  @Post('movies')
  async createMovie(
    @Headers('x-telegram-id') telegramId: string,
    @Body() dto: CreateMovieDto,
  ) {
    this.validateAdmin(telegramId);
    dto.uploaded_by = parseInt(telegramId);
    const movie = await this.moviesService.create(dto);
    return { success: true, data: movie };
  }

  @Put('movies/:id')
  async updateMovie(
    @Headers('x-telegram-id') telegramId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMovieDto,
  ) {
    this.validateAdmin(telegramId);
    const movie = await this.moviesService.update(parseInt(id), dto);
    return { success: true, data: movie };
  }

  @Delete('movies/:id')
  async deleteMovie(
    @Headers('x-telegram-id') telegramId: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(telegramId);
    await this.moviesService.delete(parseInt(id));
    return { success: true };
  }

  @Patch('movies/:id/premiere')
  async setMoviePremiere(
    @Headers('x-telegram-id') telegramId: string,
    @Param('id') id: string,
    @Body() dto: SetPremiereDto,
  ) {
    this.validateAdmin(telegramId);
    await this.moviesService.setPremiere(parseInt(id), dto.is_premiere, dto.order);
    return { success: true };
  }

  // ========== CHANNELS ==========
  @Get('channels')
  async getChannels(@Headers('x-telegram-id') telegramId: string) {
    this.validateAdmin(telegramId);
    const channels = await this.telegramService.getAllChannelsWithDetails();
    return { success: true, data: channels };
  }

  @Post('channels')
  async createChannel(
    @Headers('x-telegram-id') telegramId: string,
    @Body() dto: CreateChannelDto,
  ) {
    this.validateAdmin(telegramId);
    const channel = await this.channelsService.create(dto);
    return { success: true, data: channel };
  }

  @Patch('channels/:id')
  async patchChannel(
    @Headers('x-telegram-id') telegramId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    this.validateAdmin(telegramId);
    const channel = await this.channelsService.update(parseInt(id), dto);
    return { success: true, data: channel };
  }

  @Put('channels/:id')
  async updateChannel(
    @Headers('x-telegram-id') telegramId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    this.validateAdmin(telegramId);
    const channel = await this.channelsService.update(parseInt(id), dto);
    return { success: true, data: channel };
  }

  @Delete('channels/:id')
  async deleteChannel(
    @Headers('x-telegram-id') telegramId: string,
    @Param('id') id: string,
  ) {
    this.validateAdmin(telegramId);
    await this.channelsService.delete(parseInt(id));
    return { success: true };
  }

  // ========== USERS ==========
  @Get('users')
  async getUsers(
    @Headers('x-telegram-id') telegramId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('filter') filter: 'all' | 'subscribed' | 'unsubscribed' = 'all',
    @Query('search') search?: string,
  ) {
    this.validateAdmin(telegramId);
    const result = await this.usersService.findAll(
      parseInt(page),
      parseInt(limit),
      filter,
      search,
    );
    return { success: true, data: result };
  }

  @Patch('users/:id/ban')
  async banUser(
    @Headers('x-telegram-id') telegramId: string,
    @Param('id') id: string,
    @Body() dto: { isBanned: boolean },
  ) {
    this.validateAdmin(telegramId);
    await this.usersService.setBanned(parseInt(id), dto.isBanned);
    return { success: true };
  }

  @Get('users/:telegramId/views')
  async getUserViews(
    @Headers('x-telegram-id') adminTelegramId: string,
    @Param('telegramId') userTelegramId: string,
  ) {
    this.validateAdmin(adminTelegramId);
    const views = await this.usersService.getUserViews(parseInt(userTelegramId));
    return { success: true, data: views };
  }
}
