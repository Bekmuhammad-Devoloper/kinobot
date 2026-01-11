import { Update, Ctx, Start, On, Hears, Action, Command } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import { TelegramService, BotContext } from './telegram.service';
import { UserKeyboard, AdminKeyboard } from './keyboards';
import { Message } from 'telegraf/types';

@Update()
export class TelegramUpdate {
  private webAppUrl: string;
  private adminWebAppUrl: string;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {
    this.webAppUrl = this.configService.get('WEB_APP_URL', 'https://yourdomain.com/webapp');
    this.adminWebAppUrl = this.configService.get('ADMIN_WEB_APP_URL', 'https://yourdomain.com/webapp/admin');
  }

  // ============ START COMMAND ============
  @Start()
  async onStart(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user) return;

    // Save or update user
    await this.telegramService.findOrCreateUser(
      user.id,
      user.username,
      `${user.first_name || ''} ${user.last_name || ''}`.trim()
    );

    // Check if admin
    if (this.telegramService.isAdmin(user.id)) {
      await this.telegramService.findOrCreateAdmin(
        user.id,
        user.username,
        `${user.first_name || ''} ${user.last_name || ''}`.trim()
      );
    }

    // Check subscription
    const { subscribed, unsubscribedChannels } = await this.telegramService.checkUserSubscription(user.id);

    if (!subscribed && unsubscribedChannels.length > 0) {
      await ctx.reply(
        '👋 Assalomu alaykum!\n\n' +
        '🎬 Kino botimizga xush kelibsiz!\n\n' +
        '⚠️ Botdan foydalanish uchun quyidagi kanallarga obuna bo\'ling:',
        UserKeyboard.subscriptionButtons(unsubscribedChannels)
      );
    } else {
      await this.showMainMenu(ctx);
    }
  }

  // ============ SUBSCRIPTION CHECK ============
  @Action('check_subscription')
  async onCheckSubscription(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user) return;

    const { subscribed, unsubscribedChannels } = await this.telegramService.checkUserSubscription(user.id);

    if (subscribed) {
      await ctx.answerCbQuery('✅ Barcha kanallarga obuna bo\'lgansiz!');
      await ctx.deleteMessage();
      await this.showMainMenu(ctx);
    } else {
      await ctx.answerCbQuery('❌ Hali barcha kanallarga obuna bo\'lmadingiz!');
      await ctx.editMessageText(
        '⚠️ Iltimos, barcha kanallarga obuna bo\'ling:',
        UserKeyboard.subscriptionButtons(unsubscribedChannels)
      );
    }
  }

  // ============ MAIN MENU ============
  async showMainMenu(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    const isAdmin = this.telegramService.isAdmin(user.id);

    await ctx.reply(
      '🎬 Asosiy Menyu\n\n' +
      'Quyidagi tugmalardan birini tanlang:' +
      (isAdmin ? '\n\n👑 Siz adminsiz! /admin buyrug\'i orqali admin panelga o\'ting.' : ''),
      UserKeyboard.mainMenu(`${this.webAppUrl}/premiere`)
    );
  }

  // ============ PREMIERE MOVIES ============
  @Hears('🎬 Premyera Kinolar')
  async onPremiereMovies(@Ctx() ctx: BotContext) {
    const movies = await this.telegramService.getPremiereMovies();
    
    if (movies.length === 0) {
      await ctx.reply('😔 Hozircha premyera kinolar yo\'q.');
      return;
    }

    // Birinchi kinoni ko'rsatish
    await this.showPremiereMovie(ctx, movies, 0);
  }

  // Premyera kinoni ko'rsatish
  private async showPremiereMovie(ctx: BotContext, movies: any[], index: number, editMessage: boolean = false) {
    const movie = movies[index];
    
    const caption = 
      `🎬 <b>${movie.title}</b>\n\n` +
      `${movie.description || 'Tavsif yo\'q'}\n\n` +
      `📊 Ko'rishlar: ${movie.views_count || 0}\n` +
      `⏱ Davomiyligi: ${movie.duration || 'Noma\'lum'}`;
    
    const keyboard = UserKeyboard.premiereCarousel(movies, index);
    
    try {
      if (editMessage && ctx.callbackQuery?.message) {
        // Agar thumbnail bo'lsa, rasm bilan edit qilish
        if (movie.thumbnail_file_id) {
          await ctx.editMessageMedia(
            {
              type: 'photo',
              media: movie.thumbnail_file_id,
              caption,
              parse_mode: 'HTML',
            },
            keyboard
          );
        } else {
          await ctx.editMessageCaption(caption, { parse_mode: 'HTML', ...keyboard });
        }
      } else {
        // Yangi xabar yuborish
        if (movie.thumbnail_file_id) {
          await ctx.replyWithPhoto(movie.thumbnail_file_id, {
            caption,
            parse_mode: 'HTML',
            ...keyboard,
          });
        } else {
          await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
        }
      }
    } catch (error) {
      console.error('Error showing premiere movie:', error);
      // Fallback: oddiy text xabar
      await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
    }
  }

  // Premyera carousel navigation
  @Action(/^premiere_(prev|next)_(\d+)$/)
  async onPremiereNav(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    
    const match = ctx.callbackQuery && 'data' in ctx.callbackQuery 
      ? ctx.callbackQuery.data.match(/^premiere_(prev|next)_(\d+)$/)
      : null;
    
    if (!match) return;
    
    const direction = match[1];
    const currentIndex = parseInt(match[2]);
    const movies = await this.telegramService.getPremiereMovies();
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex >= 0 && newIndex < movies.length) {
      await this.showPremiereMovie(ctx, movies, newIndex, true);
    }
  }

  // No operation - for page indicators
  @Action('noop')
  async onNoop(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
  }

  // Premyera kinoni ko'rish
  @Action(/^watch_premiere_(\d+)$/)
  async onWatchPremiere(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery('📥 Kino yuklanmoqda...');
    
    const match = ctx.callbackQuery && 'data' in ctx.callbackQuery 
      ? ctx.callbackQuery.data.match(/^watch_premiere_(\d+)$/)
      : null;
    
    if (!match) return;
    
    const movieId = parseInt(match[1]);
    const movie = await this.telegramService.getMovieById(movieId);
    
    if (!movie) {
      await ctx.reply('❌ Kino topilmadi.');
      return;
    }

    // Ko'rishlar sonini oshirish va user view qo'shish
    if (ctx.from) {
      await this.telegramService.incrementMovieViews(movie.id, ctx.from.id);
    }
    
    // Video yuborish
    await ctx.replyWithVideo(movie.file_id, {
      caption: `🎬 <b>${movie.title}</b>\n\n${movie.description || ''}`,
      parse_mode: 'HTML',
    });
  }

  // ============ SEARCH BY CODE ============
  @Hears('🔍 Kod orqali ko\'rish')
  async onSearchByCode(@Ctx() ctx: BotContext) {
    ctx.session.scene = 'search_by_code';
    await ctx.reply(
      '🔍 Kino kodini kiriting:\n\n' +
      'Masalan: KN001, FILM123',
      UserKeyboard.back()
    );
  }

  // ============ USER STATS ============
  @Hears('📊 Mening statistikam')
  async onUserStats(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user) return;

    const stats = await this.telegramService.getUserStats(user.id);
    
    await ctx.reply(
      '📊 Sizning statistikangiz:\n\n' +
      `👁 Ko'rilgan kinolar: ${stats.viewsCount}\n` +
      `📅 Oxirgi faollik: ${stats.lastView ? stats.lastView.toLocaleDateString('uz-UZ') : 'Hali ko\'rmadingiz'}`
    );
  }

  // ============ HELP ============
  @Hears('ℹ️ Yordam')
  async onHelp(@Ctx() ctx: BotContext) {
    await ctx.reply(
      'ℹ️ Yordam\n\n' +
      '🎬 Premyera Kinolar - Eng yangi kinolarni ko\'ring\n' +
      '🔍 Kod orqali ko\'rish - Kino kodini kiritib, kinoni toping\n' +
      '📊 Mening statistikam - O\'z statistikangizni ko\'ring\n\n' +
      '📞 Savol va takliflar uchun: @Bobrr1234',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📞 Admin bilan bog\'lanish', url: 'https://t.me/Bobrr1234' }]
          ]
        }
      }
    );
  }

  // ============ ADMIN COMMAND ============
  @Command('admin')
  async onAdminCommand(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) {
      await ctx.reply('⛔ Sizda admin huquqi yo\'q!');
      return;
    }

    await ctx.reply(
      '👑 Admin Panel\n\n' +
      'Quyidagi tugmalardan birini tanlang:',
      AdminKeyboard.mainMenu()
    );
  }

  // ============ ADMIN - UPLOAD MOVIE ============
  @Hears('📤 Kino Yuklash')
  async onUploadMovie(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    ctx.session.scene = 'upload_movie';
    ctx.session.step = 1;
    ctx.session.movieData = {};

    await ctx.reply(
      '📤 Kino Yuklash\n\n' +
      '1️⃣ Kino kodini kiriting (masalan: KN001):',
      AdminKeyboard.cancel()
    );
  }

  // ============ ADMIN - MOVIE LIST ============
  @Hears('📋 Kinolar Ro\'yxati')
  async onMovieList(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    await this.showMoviesList(ctx, 1);
  }

  async showMoviesList(@Ctx() ctx: BotContext, page: number) {
    const { movies, total } = await this.telegramService.getAllMovies(page, 5);
    const totalPages = Math.ceil(total / 5);

    if (movies.length === 0) {
      await ctx.reply('📋 Hozircha kinolar yo\'q.');
      return;
    }

    let message = `📋 Kinolar Ro'yxati (${page}/${totalPages})\n\n`;
    
    for (const movie of movies) {
      message += `🎬 ${movie.code} - ${movie.title}\n`;
      message += `👁 Ko'rishlar: ${movie.views_count} | `;
      message += movie.is_premiere ? '⭐ Premyera\n\n' : '\n\n';
    }

    const pagination = AdminKeyboard.moviesPagination(page, totalPages);
    
    if (pagination) {
      await ctx.reply(message, pagination);
    } else {
      await ctx.reply(message);
    }

    // Show individual movie actions
    for (const movie of movies) {
      await ctx.reply(
        `${movie.code}: ${movie.title}`,
        AdminKeyboard.movieActions(movie.id)
      );
    }
  }

  // ============ ADMIN - PREMIERE SETTINGS ============
  @Hears('⭐ Premyera Sozlash')
  async onPremiereSettings(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    const movies = await this.telegramService.getPremiereMovies();

    if (movies.length === 0) {
      await ctx.reply(
        '⭐ Premyera Kinolar\n\n' +
        'Hozircha premyera kinolar yo\'q.\n' +
        'Kinolar ro\'yxatidan kinoni premyera qilishingiz mumkin.'
      );
      return;
    }

    await ctx.reply('⭐ Premyera Kinolar tartibini o\'zgartiring:');

    for (const movie of movies) {
      await ctx.reply(
        `${movie.premiere_order + 1}. ${movie.code} - ${movie.title}`,
        AdminKeyboard.premiereActions(movie)
      );
    }
  }

  // ============ ADMIN - CHANNEL MANAGEMENT ============
  @Hears('📢 Kanallar Boshqaruvi')
  async onChannelManagement(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    await ctx.reply(
      '📢 Kanallar Boshqaruvi\n\n' +
      'Web App orqali kanallarni boshqaring:',
      AdminKeyboard.channelsWebApp(`${this.adminWebAppUrl}`)
    );
  }

  // ============ ADMIN - USER STATS ============
  @Hears('👥 Userlar Statistikasi')
  async onUsersStats(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    await ctx.reply(
      '👥 Userlar Statistikasi\n\n' +
      'Web App orqali userlarni ko\'ring:',
      AdminKeyboard.usersWebApp(`${this.adminWebAppUrl}`)
    );
  }

  // ============ ADMIN - DASHBOARD ============
  @Hears('📊 Umumiy Statistika')
  async onDashboard(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    const stats = await this.telegramService.getDashboardStats();
    const topMovies = await this.telegramService.getTopMovies(5);

    let message = '📊 Umumiy Statistika\n\n';
    message += `👥 Jami userlar: ${stats.totalUsers}\n`;
    message += `✅ Obuna bo'lgan: ${stats.subscribedUsers}\n`;
    message += `🎬 Jami kinolar: ${stats.totalMovies}\n`;
    message += `⭐ Premyera kinolar: ${stats.premiereMovies}\n`;
    message += `👁 Jami ko'rishlar: ${stats.totalViews}\n`;
    message += `📈 Bugungi yangi userlar: ${stats.todayNewUsers}\n\n`;
    
    if (topMovies.length > 0) {
      message += '🏆 Top 5 Kino:\n';
      topMovies.forEach((movie, index) => {
        message += `${index + 1}. ${movie.title} - ${movie.views_count} ko'rish\n`;
      });
    }

    await ctx.reply(message);
  }

  // ============ BACK TO USER MODE ============
  @Hears('⬅️ User Rejimiga')
  async onBackToUserMode(@Ctx() ctx: BotContext) {
    ctx.session = {};
    await this.showMainMenu(ctx);
  }

  // ============ CANCEL ============
  @Hears('❌ Bekor qilish')
  async onCancel(@Ctx() ctx: BotContext) {
    ctx.session = {};
    
    const user = ctx.from;
    if (user && this.telegramService.isAdmin(user.id)) {
      await ctx.reply('❌ Bekor qilindi.', AdminKeyboard.mainMenu());
    } else {
      await this.showMainMenu(ctx);
    }
  }

  // ============ BACK ACTION ============
  @Action('back_to_menu')
  async onBackToMenu(@Ctx() ctx: BotContext) {
    ctx.session = {};
    await ctx.deleteMessage();
    await this.showMainMenu(ctx);
  }

  // ============ WATCH MOVIE ACTION ============
  @Action(/^watch_(.+)$/)
  async onWatchMovie(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user) return;

    // Check subscription first
    const { subscribed, unsubscribedChannels } = await this.telegramService.checkUserSubscription(user.id);
    
    if (!subscribed) {
      await ctx.answerCbQuery('⚠️ Avval kanallarga obuna bo\'ling!');
      await ctx.reply(
        '⚠️ Kinoni ko\'rish uchun barcha kanallarga obuna bo\'ling:',
        UserKeyboard.subscriptionButtons(unsubscribedChannels)
      );
      return;
    }

    const match = (ctx.callbackQuery as any).data.match(/^watch_(.+)$/);
    if (!match) return;

    const movieCode = match[1];
    const movie = await this.telegramService.getMovieByCode(movieCode);

    if (!movie) {
      await ctx.answerCbQuery('❌ Kino topilmadi!');
      return;
    }

    await ctx.answerCbQuery('🎬 Kino yuklanmoqda...');

    // Send video
    try {
      await ctx.replyWithVideo(movie.file_id, {
        caption: `🎬 ${movie.title}\n\n${movie.description || ''}`,
      });

      // Increment views
      await this.telegramService.incrementMovieViews(movie.id, user.id);
    } catch (error) {
      await ctx.reply('❌ Video yuborishda xatolik yuz berdi.');
    }
  }

  // ============ MOVIE PAGINATION ============
  @Action(/^movies_page_(\d+)$/)
  async onMoviesPage(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^movies_page_(\d+)$/);
    if (!match) return;

    const page = parseInt(match[1]);
    await ctx.deleteMessage();
    await this.showMoviesList(ctx, page);
  }

  // ============ DELETE MOVIE ============
  @Action(/^delete_movie_(\d+)$/)
  async onDeleteMovie(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^delete_movie_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    await ctx.editMessageText(
      '⚠️ Rostdan ham bu kinoni o\'chirmoqchimisiz?',
      AdminKeyboard.confirmDelete(movieId)
    );
  }

  @Action(/^confirm_delete_(\d+)$/)
  async onConfirmDelete(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^confirm_delete_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    await this.telegramService.deleteMovie(movieId);
    
    await ctx.answerCbQuery('✅ Kino o\'chirildi!');
    await ctx.deleteMessage();
  }

  @Action('cancel_delete')
  async onCancelDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery('❌ Bekor qilindi');
    await ctx.deleteMessage();
  }

  // ============ EDIT MOVIE ============
  @Action(/^edit_movie_(\d+)$/)
  async onEditMovie(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    const match = (ctx.callbackQuery as any).data.match(/^edit_movie_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    const movie = await this.telegramService.getMovieById(movieId);

    if (!movie) {
      await ctx.answerCbQuery('❌ Kino topilmadi!');
      return;
    }

    ctx.session.scene = 'edit_movie';
    ctx.session.step = 1;
    ctx.session.editMovieId = movieId;
    ctx.session.editMovieData = {};

    await ctx.answerCbQuery('✏️ Tahrirlash');
    await ctx.reply(
      `✏️ Kino Tahrirlash: ${movie.title}\n\n` +
      `Hozirgi ma'lumotlar:\n` +
      `📋 Kod: ${movie.code}\n` +
      `🎬 Nom: ${movie.title}\n` +
      `📝 Tavsif: ${movie.description || 'Yo\'q'}\n` +
      `⭐ Premyera: ${movie.is_premiere ? 'Ha' : 'Yo\'q'}\n\n` +
      `Nimani o'zgartirmoqchisiz?`,
      AdminKeyboard.editMovieOptions(movieId)
    );
  }

  @Action(/^edit_title_(\d+)$/)
  async onEditMovieTitle(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^edit_title_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    ctx.session.scene = 'edit_movie_title';
    ctx.session.editMovieId = movieId;

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '✏️ Yangi nomni kiriting:',
      AdminKeyboard.cancelInline()
    );
  }

  @Action(/^edit_description_(\d+)$/)
  async onEditMovieDescription(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^edit_description_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    ctx.session.scene = 'edit_movie_description';
    ctx.session.editMovieId = movieId;

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '✏️ Yangi tavsifni kiriting:',
      AdminKeyboard.cancelInline()
    );
  }

  @Action(/^edit_code_(\d+)$/)
  async onEditMovieCode(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^edit_code_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    ctx.session.scene = 'edit_movie_code';
    ctx.session.editMovieId = movieId;

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '✏️ Yangi kodni kiriting:',
      AdminKeyboard.cancelInline()
    );
  }

  @Action('cancel_edit')
  async onCancelEdit(@Ctx() ctx: BotContext) {
    ctx.session = {};
    await ctx.answerCbQuery('❌ Bekor qilindi');
    await ctx.deleteMessage();
  }

  @Action(/^edit_cancel_(\d+)$/)
  async onEditCancel(@Ctx() ctx: BotContext) {
    ctx.session = {};
    await ctx.answerCbQuery('❌ Bekor qilindi');
    await ctx.deleteMessage();
  }

  // ============ MOVIE STATISTICS ============
  @Action(/^stats_movie_(\d+)$/)
  async onMovieStats(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    const match = (ctx.callbackQuery as any).data.match(/^stats_movie_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    const stats = await this.telegramService.getMovieStats(movieId);

    if (!stats) {
      await ctx.answerCbQuery('❌ Kino topilmadi!');
      return;
    }

    await ctx.answerCbQuery('📊 Statistika');
    await ctx.reply(
      `📊 Kino Statistikasi\n\n` +
      `🎬 ${stats.title}\n` +
      `📋 Kod: ${stats.code}\n\n` +
      `👁 Jami ko'rishlar: ${stats.totalViews}\n` +
      `👥 Noyob ko'ruvchilar: ${stats.uniqueViewers}\n` +
      `📅 Bugungi ko'rishlar: ${stats.todayViews}\n` +
      `📈 Haftalik ko'rishlar: ${stats.weeklyViews}\n\n` +
      `🕐 Oxirgi ko'rish: ${stats.lastViewedAt ? new Date(stats.lastViewedAt).toLocaleString('uz-UZ') : 'Hali ko\'rilmagan'}\n` +
      `📆 Qo'shilgan: ${new Date(stats.createdAt).toLocaleDateString('uz-UZ')}`
    );
  }

  // ============ PREMIERE ACTIONS ============
  @Action(/^premiere_movie_(\d+)$/)
  async onTogglePremiere(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^premiere_movie_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    const movies = await this.telegramService.getPremiereMovies();
    const isCurrentlyPremiere = movies.some(m => m.id === movieId);

    await this.telegramService.setMoviePremiere(movieId, !isCurrentlyPremiere, movies.length);
    
    await ctx.answerCbQuery(isCurrentlyPremiere ? '❌ Premyeradan olib tashlandi' : '⭐ Premyera qilindi');
  }

  @Action(/^premiere_up_(\d+)$/)
  async onPremiereUp(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^premiere_up_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    // Implementation for moving up in order
    await ctx.answerCbQuery('⬆️ Yuqoriga ko\'tarildi');
  }

  @Action(/^premiere_down_(\d+)$/)
  async onPremiereDown(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^premiere_down_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    // Implementation for moving down in order
    await ctx.answerCbQuery('⬇️ Pastga tushirildi');
  }

  @Action(/^premiere_remove_(\d+)$/)
  async onPremiereRemove(@Ctx() ctx: BotContext) {
    const match = (ctx.callbackQuery as any).data.match(/^premiere_remove_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    await this.telegramService.setMoviePremiere(movieId, false);
    
    await ctx.answerCbQuery('❌ Premyeradan olib tashlandi');
    await ctx.deleteMessage();
  }

  // ============ TEXT MESSAGE HANDLER ============
  @On('text')
  async onText(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user) return;

    const message = ctx.message as Message.TextMessage;
    const text = message.text;

    // Handle scenes
    if (ctx.session?.scene === 'search_by_code') {
      const movie = await this.telegramService.getMovieByCode(text);
      
      if (movie) {
        ctx.session = {};
        
        let caption = `🎬 ${movie.title}\n\n`;
        if (movie.description) caption += `📝 ${movie.description}\n\n`;
        caption += `👁 Ko'rishlar: ${movie.views_count}\n`;
        caption += `📅 Qo'shilgan: ${movie.created_at.toLocaleDateString('uz-UZ')}`;

        if (movie.thumbnail_file_id) {
          await ctx.replyWithPhoto(movie.thumbnail_file_id, {
            caption,
            ...UserKeyboard.watchMovie(movie.code),
          });
        } else {
          await ctx.reply(caption, UserKeyboard.watchMovie(movie.code));
        }
      } else {
        await ctx.reply('❌ Bu kod bilan kino topilmadi. Qayta urinib ko\'ring:');
      }
      return;
    }

    // Handle upload movie scene
    if (ctx.session?.scene === 'upload_movie' && this.telegramService.isAdmin(user.id)) {
      await this.handleUploadMovieScene(ctx, text);
      return;
    }

    // Handle edit movie title
    if (ctx.session?.scene === 'edit_movie_title' && this.telegramService.isAdmin(user.id)) {
      const movieId = ctx.session.editMovieId;
      await this.telegramService.updateMovie(movieId, { title: text });
      ctx.session = {};
      await ctx.reply('✅ Kino nomi yangilandi!', AdminKeyboard.mainMenu());
      return;
    }

    // Handle edit movie description
    if (ctx.session?.scene === 'edit_movie_description' && this.telegramService.isAdmin(user.id)) {
      const movieId = ctx.session.editMovieId;
      await this.telegramService.updateMovie(movieId, { description: text });
      ctx.session = {};
      await ctx.reply('✅ Kino tavsifi yangilandi!', AdminKeyboard.mainMenu());
      return;
    }

    // Handle edit movie code
    if (ctx.session?.scene === 'edit_movie_code' && this.telegramService.isAdmin(user.id)) {
      const movieId = ctx.session.editMovieId;
      await this.telegramService.updateMovie(movieId, { code: text.toUpperCase() });
      ctx.session = {};
      await ctx.reply('✅ Kino kodi yangilandi!', AdminKeyboard.mainMenu());
      return;
    }

    // Check if it's a movie code
    const movie = await this.telegramService.getMovieByCode(text);
    if (movie) {
      // Check subscription
      const { subscribed, unsubscribedChannels } = await this.telegramService.checkUserSubscription(user.id);
      
      if (!subscribed) {
        await ctx.reply(
          '⚠️ Kinoni ko\'rish uchun barcha kanallarga obuna bo\'ling:',
          UserKeyboard.subscriptionButtons(unsubscribedChannels)
        );
        return;
      }

      let caption = `🎬 ${movie.title}\n\n`;
      if (movie.description) caption += `📝 ${movie.description}\n\n`;
      caption += `👁 Ko'rishlar: ${movie.views_count}`;

      if (movie.thumbnail_file_id) {
        await ctx.replyWithPhoto(movie.thumbnail_file_id, {
          caption,
          ...UserKeyboard.watchMovie(movie.code),
        });
      } else {
        await ctx.reply(caption, UserKeyboard.watchMovie(movie.code));
      }
    }
  }

  // ============ VIDEO HANDLER (for admin upload) ============
  @On('video')
  async onVideo(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    if (ctx.session?.scene === 'upload_movie' && ctx.session?.step === 4) {
      const message = ctx.message as Message.VideoMessage;
      const video = message.video;

      ctx.session.movieData.file_id = video.file_id;
      ctx.session.movieData.file_type = 'video';
      ctx.session.movieData.duration = video.duration;
      ctx.session.movieData.file_size = video.file_size;
      
      // Agar video da thumb bo'lsa, avtomatik thumbnail sifatida saqlash
      if (video.thumbnail) {
        ctx.session.movieData.auto_thumbnail_file_id = video.thumbnail.file_id;
      }
      
      ctx.session.step = 5;

      await ctx.reply(
        '5️⃣ Thumbnail rasm yuboring (ixtiyoriy - video dan avtomatik olinadi agar yubormasangiz):',
        AdminKeyboard.skipOrCancel()
      );
    }
  }

  // ============ PHOTO HANDLER (for thumbnail) ============
  @On('photo')
  async onPhoto(@Ctx() ctx: BotContext) {
    const user = ctx.from;
    if (!user || !this.telegramService.isAdmin(user.id)) return;

    if (ctx.session?.scene === 'upload_movie' && ctx.session?.step === 5) {
      const message = ctx.message as Message.PhotoMessage;
      const photo = message.photo;
      const largestPhoto = photo[photo.length - 1];

      ctx.session.movieData.thumbnail_file_id = largestPhoto.file_id;
      ctx.session.step = 6;

      await ctx.reply(
        '6️⃣ Bu kino premyera bo\'lsinmi?',
        AdminKeyboard.yesNo()
      );
    }
  }

  // ============ UPLOAD MOVIE SCENE HANDLER ============
  async handleUploadMovieScene(@Ctx() ctx: BotContext, text: string) {
    const step = ctx.session.step;

    switch (step) {
      case 1: // Movie code
        const existingMovie = await this.telegramService.getMovieByCode(text);
        if (existingMovie) {
          await ctx.reply('❌ Bu kod bilan kino mavjud! Boshqa kod kiriting:');
          return;
        }
        ctx.session.movieData.code = text.toUpperCase();
        ctx.session.step = 2;
        await ctx.reply('2️⃣ Kino nomini kiriting:', AdminKeyboard.cancel());
        break;

      case 2: // Movie title
        ctx.session.movieData.title = text;
        ctx.session.step = 3;
        await ctx.reply('3️⃣ Kino tavsifini kiriting:', AdminKeyboard.skipOrCancel());
        break;

      case 3: // Movie description
        if (text !== '⏭ O\'tkazib yuborish') {
          ctx.session.movieData.description = text;
        }
        ctx.session.step = 4;
        await ctx.reply('4️⃣ Video faylni yuboring:', AdminKeyboard.cancel());
        break;

      case 5: // Skip thumbnail
        if (text === '⏭ O\'tkazib yuborish') {
          // Agar user thumbnail yubormasa, video ning avtomatik thumbnailini ishlatish
          if (ctx.session.movieData.auto_thumbnail_file_id) {
            ctx.session.movieData.thumbnail_file_id = ctx.session.movieData.auto_thumbnail_file_id;
          }
          ctx.session.step = 6;
          await ctx.reply('6️⃣ Bu kino premyera bo\'lsinmi?', AdminKeyboard.yesNo());
        }
        break;

      case 6: // Premiere
        if (text === '✅ Ha') {
          ctx.session.movieData.is_premiere = true;
          const premiereMovies = await this.telegramService.getPremiereMovies();
          ctx.session.movieData.premiere_order = premiereMovies.length;
        } else {
          ctx.session.movieData.is_premiere = false;
        }

        // Save movie
        ctx.session.movieData.uploaded_by = ctx.from.id;
        const movie = await this.telegramService.createMovie(ctx.session.movieData);

        await ctx.reply(
          '✅ Kino muvaffaqiyatli yuklandi!\n\n' +
          `📝 Kod: ${movie.code}\n` +
          `🎬 Nom: ${movie.title}\n` +
          `⭐ Premyera: ${movie.is_premiere ? 'Ha' : 'Yo\'q'}`,
          AdminKeyboard.mainMenu()
        );

        ctx.session = {};
        break;
    }
  }
}
