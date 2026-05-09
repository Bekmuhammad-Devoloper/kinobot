import { Telegraf, Markup } from 'telegraf';
import { Message } from 'telegraf/types';
import { TelegramService, BotContext } from './telegram.service';
import { UserKeyboard, AdminKeyboard } from './keyboards';

export interface BotConfig {
  botId: number;
  webAppUrl: string;
  adminWebAppUrl: string;
  contactUsername?: string;
}

export function registerBotHandlers(
  bot: Telegraf<BotContext>,
  cfg: BotConfig,
  svc: TelegramService,
) {
  const { botId, webAppUrl, adminWebAppUrl } = cfg;
  const contact = cfg.contactUsername || 'admin';

  // Telegram WebApp tugmalari faqat HTTPS URL bilan ishlaydi.
  // Lokal HTTP holatda WebApp tugmalari bermaymiz (oddiy keyboard ishlatamiz).
  const isHttps = (u: string) => typeof u === 'string' && u.startsWith('https://');
  const premiereWebApp = isHttps(webAppUrl) ? `${webAppUrl}/premiere?bot=${botId}` : undefined;
  const adminWebApp = isHttps(adminWebAppUrl) ? `${adminWebAppUrl}?bot=${botId}` : undefined;

  const isAdmin = (telegramId: number) => svc.isAdmin(botId, telegramId);

  // file_type'ga qarab kerakli replyWith* metodini chaqirish
  async function sendMovieMedia(ctx: BotContext, movie: { file_id: string; file_type?: string; title: string; description?: string; views_count?: number }) {
    const caption = `🎬 ${movie.title}\n\n${movie.description || ''}\n\n👁 Ko'rishlar: ${movie.views_count ?? 0}`;
    const ft = movie.file_type || 'video';
    try {
      if (ft === 'animation') {
        await ctx.replyWithAnimation(movie.file_id, { caption });
      } else if (ft === 'video_note') {
        await ctx.replyWithVideoNote(movie.file_id);
        await ctx.reply(caption);
      } else if (ft === 'document') {
        await ctx.replyWithDocument(movie.file_id, { caption });
      } else {
        await ctx.replyWithVideo(movie.file_id, { caption });
      }
    } catch (e) {
      // Fallback — har bir holatga document orqali yuborib ko'rish
      try {
        await ctx.replyWithDocument(movie.file_id, { caption });
      } catch (err) {
        console.error('sendMovieMedia failed:', err);
        await ctx.reply('❌ Kinoni yuborishda xatolik yuz berdi.');
      }
    }
  }

  async function showMainMenu(ctx: BotContext) {
    const user = ctx.from;
    const admin = await isAdmin(user.id);

    await ctx.reply(
      '🎬 Asosiy Menyu\n\n' +
      'Quyidagi tugmalardan birini tanlang:' +
      (admin ? '\n\n👑 Siz adminsiz! /admin buyrug\'i orqali admin panelga o\'ting.' : ''),
      UserKeyboard.mainMenu(premiereWebApp)
    );
  }

  async function showMoviesList(ctx: BotContext, page: number) {
    const { movies, total } = await svc.getAllMovies(botId, page, 5);
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

    for (const movie of movies) {
      await ctx.reply(
        `${movie.code}: ${movie.title}`,
        AdminKeyboard.movieActions(movie.id)
      );
    }
  }

  async function handleUploadMovieScene(ctx: BotContext, text: string) {
    const step = ctx.session.step;

    switch (step) {
      case 1: {
        const existing = await svc.getMovieByCode(botId, text);
        if (existing) {
          await ctx.reply('❌ Bu kod bilan kino mavjud! Boshqa kod kiriting:');
          return;
        }
        ctx.session.movieData.code = text.toUpperCase();
        ctx.session.step = 2;
        await ctx.reply('2️⃣ Kino nomini kiriting:', AdminKeyboard.cancel());
        break;
      }
      case 2:
        ctx.session.movieData.title = text;
        ctx.session.step = 3;
        await ctx.reply('3️⃣ Kino tavsifini kiriting:', AdminKeyboard.skipOrCancel());
        break;

      case 3:
        if (text !== '⏭ O\'tkazib yuborish') {
          ctx.session.movieData.description = text;
        }
        ctx.session.step = 4;
        await ctx.reply('4️⃣ Video faylni yuboring:', AdminKeyboard.cancel());
        break;

      case 5:
        if (text === '⏭ O\'tkazib yuborish') {
          if (ctx.session.movieData.auto_thumbnail_file_id) {
            ctx.session.movieData.thumbnail_file_id = ctx.session.movieData.auto_thumbnail_file_id;
          }
          ctx.session.step = 6;
          await ctx.reply('6️⃣ Bu kino premyera bo\'lsinmi?', AdminKeyboard.yesNo());
        }
        break;

      case 6: {
        if (text === '✅ Ha') {
          ctx.session.movieData.is_premiere = true;
          const premiereMovies = await svc.getPremiereMovies(botId);
          ctx.session.movieData.premiere_order = premiereMovies.length;
        } else {
          ctx.session.movieData.is_premiere = false;
        }

        ctx.session.movieData.uploaded_by = ctx.from.id;
        const movie = await svc.createMovie(botId, ctx.session.movieData);

        await ctx.reply(
          '✅ Kino muvaffaqiyatli yuklandi!\n\n' +
          `📝 Kod: ${movie.code}\n` +
          `🎬 Nom: ${movie.title}\n` +
          `⭐ Premyera: ${movie.is_premiere ? 'Ha' : 'Yo\'q'}`,
          AdminKeyboard.mainMenu()
        );

        ctx.session = {} as any;
        break;
      }
    }
  }

  // ============ START ============
  bot.start(async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    await svc.findOrCreateUser(
      botId,
      user.id,
      user.username,
      `${user.first_name || ''} ${user.last_name || ''}`.trim()
    );

    await svc.findOrCreateAdmin(
      botId,
      user.id,
      user.username,
      `${user.first_name || ''} ${user.last_name || ''}`.trim()
    );

    const { subscribed, unsubscribedChannels } = await svc.checkUserSubscription(botId, bot, user.id);

    if (!subscribed && unsubscribedChannels.length > 0) {
      await ctx.reply(
        '👋 Assalomu alaykum!\n\n' +
        '🎬 Kino botimizga xush kelibsiz!\n\n' +
        '⚠️ Botdan foydalanish uchun quyidagi kanallarga obuna bo\'ling:',
        UserKeyboard.subscriptionButtons(unsubscribedChannels)
      );
    } else {
      await showMainMenu(ctx);
    }
  });

  // ============ CHECK SUBSCRIPTION ============
  bot.action('check_subscription', async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const { subscribed, unsubscribedChannels } = await svc.checkUserSubscription(botId, bot, user.id);

    if (subscribed) {
      await ctx.answerCbQuery('✅ Barcha kanallarga obuna bo\'lgansiz!');
      try { await ctx.deleteMessage(); } catch {}
      await showMainMenu(ctx);
    } else {
      await ctx.answerCbQuery('❌ Hali barcha kanallarga obuna bo\'lmadingiz!');
      await ctx.editMessageText(
        '⚠️ Iltimos, barcha kanallarga obuna bo\'ling:',
        UserKeyboard.subscriptionButtons(unsubscribedChannels)
      );
    }
  });

  // ============ PREMIERE ============
  bot.hears('🎬 Premyera Kinolar', async (ctx) => {
    const movies = await svc.getPremiereMovies(botId);
    if (movies.length === 0) {
      await ctx.reply('😔 Hozircha premyera kinolar yo\'q.');
      return;
    }
    if (premiereWebApp) {
      await ctx.reply(
        '🎬 <b>Premyera Kinolar</b>\n\n' +
        `📊 Jami: ${movies.length} ta kino\n\n` +
        'Quyidagi tugmani bosib premyera kinolarni ko\'ring:',
        { parse_mode: 'HTML', ...UserKeyboard.premiereWebApp(premiereWebApp) }
      );
    } else {
      let listMsg = '🎬 <b>Premyera Kinolar</b>\n\n';
      movies.forEach((m, i) => {
        listMsg += `${i + 1}. <b>${m.title}</b> (kod: ${m.code})\n`;
      });
      listMsg += '\n👉 Kodi orqali izlash uchun "🔍 Kod orqali ko\'rish" tugmasini bosing.';
      await ctx.reply(listMsg, { parse_mode: 'HTML' });
    }
  });

  // ============ SEARCH BY CODE ============
  bot.hears('🔍 Kod orqali ko\'rish', async (ctx) => {
    ctx.session.scene = 'search_by_code';
    await ctx.reply(
      '🔍 Kino kodini kiriting:\n\nMasalan: KN001, FILM123',
      UserKeyboard.back()
    );
  });

  // ============ STATS ============
  bot.hears('📊 Mening statistikam', async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    const stats = await svc.getUserStats(botId, user.id);
    await ctx.reply(
      '📊 Sizning statistikangiz:\n\n' +
      `👁 Ko'rilgan kinolar: ${stats.viewsCount}\n` +
      `📅 Oxirgi faollik: ${stats.lastView ? stats.lastView.toLocaleDateString('uz-UZ') : 'Hali ko\'rmadingiz'}`
    );
  });

  // ============ HELP ============
  bot.hears('ℹ️ Yordam', async (ctx) => {
    await ctx.reply(
      'ℹ️ Yordam\n\n' +
      '🎬 Premyera Kinolar - Eng yangi kinolarni ko\'ring\n' +
      '🔍 Kod orqali ko\'rish - Kino kodini kiritib, kinoni toping\n' +
      '📊 Mening statistikam - O\'z statistikangizni ko\'ring\n\n' +
      `📞 Savol va takliflar uchun: @${contact}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📞 Admin bilan bog\'lanish', url: `https://t.me/${contact}` }]
          ]
        }
      }
    );
  });

  // ============ ADMIN ============
  bot.command('admin', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) {
      await ctx.reply('⛔ Sizda admin huquqi yo\'q!');
      return;
    }
    await ctx.reply('👑 Admin Panel\n\nQuyidagi tugmalardan birini tanlang:', AdminKeyboard.mainMenu());
  });

  bot.hears('📤 Kino Yuklash', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    ctx.session.scene = 'upload_movie';
    ctx.session.step = 1;
    ctx.session.movieData = {};
    await ctx.reply('📤 Kino Yuklash\n\n1️⃣ Kino kodini kiriting (masalan: KN001):', AdminKeyboard.cancel());
  });

  bot.hears('📋 Kinolar Ro\'yxati', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    await showMoviesList(ctx, 1);
  });

  bot.hears('⭐ Premyera Sozlash', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    const movies = await svc.getPremiereMovies(botId);
    if (movies.length === 0) {
      await ctx.reply('⭐ Premyera Kinolar\n\nHozircha premyera kinolar yo\'q.\nKinolar ro\'yxatidan kinoni premyera qilishingiz mumkin.');
      return;
    }
    await ctx.reply('⭐ Premyera Kinolar tartibini o\'zgartiring:');
    for (const movie of movies) {
      await ctx.reply(
        `${movie.premiere_order + 1}. ${movie.code} - ${movie.title}`,
        AdminKeyboard.premiereActions(movie)
      );
    }
  });

  bot.hears('📢 Kanallar Boshqaruvi', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    if (adminWebApp) {
      await ctx.reply(
        '📢 Kanallar Boshqaruvi\n\nWeb App orqali kanallarni boshqaring:',
        AdminKeyboard.channelsWebApp(adminWebApp)
      );
    } else {
      await ctx.reply('📢 Kanallar Boshqaruvi\n\n⚠️ Web App URL HTTPS emas — kanallarni boshqarish uchun production deployment kerak.');
    }
  });

  bot.hears('👥 Userlar Statistikasi', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    if (adminWebApp) {
      await ctx.reply(
        '👥 Userlar Statistikasi\n\nWeb App orqali userlarni ko\'ring:',
        AdminKeyboard.usersWebApp(adminWebApp)
      );
    } else {
      await ctx.reply('👥 Userlar Statistikasi\n\n⚠️ Web App URL HTTPS emas — userlarni ko\'rish uchun production deployment kerak.');
    }
  });

  bot.hears('📊 Umumiy Statistika', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    const stats = await svc.getDashboardStats(botId);
    const topMovies = await svc.getTopMovies(botId, 5);

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
  });

  bot.hears('⬅️ User Rejimiga', async (ctx) => {
    ctx.session = {} as any;
    await showMainMenu(ctx);
  });

  bot.hears('❌ Bekor qilish', async (ctx) => {
    ctx.session = {} as any;
    const user = ctx.from;
    if (user && (await isAdmin(user.id))) {
      await ctx.reply('❌ Bekor qilindi.', AdminKeyboard.mainMenu());
    } else {
      await showMainMenu(ctx);
    }
  });

  bot.action('back_to_menu', async (ctx) => {
    ctx.session = {} as any;
    try { await ctx.deleteMessage(); } catch {}
    await showMainMenu(ctx);
  });

  // ============ WATCH ============
  bot.action(/^watch_(.+)$/, async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const { subscribed, unsubscribedChannels } = await svc.checkUserSubscription(botId, bot, user.id);
    if (!subscribed) {
      await ctx.answerCbQuery('⚠️ Avval kanallarga obuna bo\'ling!');
      await ctx.reply('⚠️ Kinoni ko\'rish uchun barcha kanallarga obuna bo\'ling:', UserKeyboard.subscriptionButtons(unsubscribedChannels));
      return;
    }

    const movieCode = (ctx.match as RegExpExecArray)[1];
    const movie = await svc.getMovieByCode(botId, movieCode);
    if (!movie) {
      await ctx.answerCbQuery('❌ Kino topilmadi!');
      return;
    }

    await ctx.answerCbQuery('🎬 Kino yuklanmoqda...');
    await sendMovieMedia(ctx, movie);
    await svc.incrementMovieViews(botId, movie.id, user.id);
  });

  bot.action(/^movies_page_(\d+)$/, async (ctx) => {
    const page = parseInt((ctx.match as RegExpExecArray)[1]);
    try { await ctx.deleteMessage(); } catch {}
    await showMoviesList(ctx, page);
  });

  bot.action(/^delete_movie_(\d+)$/, async (ctx) => {
    const movieId = parseInt((ctx.match as RegExpExecArray)[1]);
    await ctx.editMessageText('⚠️ Rostdan ham bu kinoni o\'chirmoqchimisiz?', AdminKeyboard.confirmDelete(movieId));
  });

  bot.action(/^confirm_delete_(\d+)$/, async (ctx) => {
    const movieId = parseInt((ctx.match as RegExpExecArray)[1]);
    await svc.deleteMovie(botId, movieId);
    await ctx.answerCbQuery('✅ Kino o\'chirildi!');
    try { await ctx.deleteMessage(); } catch {}
  });

  bot.action('cancel_delete', async (ctx) => {
    await ctx.answerCbQuery('❌ Bekor qilindi');
    try { await ctx.deleteMessage(); } catch {}
  });

  // ============ EDIT ============
  bot.action(/^edit_movie_(\d+)$/, async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;

    const movieId = parseInt((ctx.match as RegExpExecArray)[1]);
    const movie = await svc.getMovieById(botId, movieId);
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
      `✏️ Kino Tahrirlash: ${movie.title}\n\nHozirgi ma'lumotlar:\n` +
      `📋 Kod: ${movie.code}\n` +
      `🎬 Nom: ${movie.title}\n` +
      `📝 Tavsif: ${movie.description || 'Yo\'q'}\n` +
      `⭐ Premyera: ${movie.is_premiere ? 'Ha' : 'Yo\'q'}\n\nNimani o'zgartirmoqchisiz?`,
      AdminKeyboard.editMovieOptions(movieId)
    );
  });

  bot.action(/^edit_title_(\d+)$/, async (ctx) => {
    const movieId = parseInt((ctx.match as RegExpExecArray)[1]);
    ctx.session.scene = 'edit_movie_title';
    ctx.session.editMovieId = movieId;
    await ctx.answerCbQuery();
    await ctx.editMessageText('✏️ Yangi nomni kiriting:', AdminKeyboard.cancelInline());
  });

  bot.action(/^edit_description_(\d+)$/, async (ctx) => {
    const movieId = parseInt((ctx.match as RegExpExecArray)[1]);
    ctx.session.scene = 'edit_movie_description';
    ctx.session.editMovieId = movieId;
    await ctx.answerCbQuery();
    await ctx.editMessageText('✏️ Yangi tavsifni kiriting:', AdminKeyboard.cancelInline());
  });

  bot.action(/^edit_code_(\d+)$/, async (ctx) => {
    const movieId = parseInt((ctx.match as RegExpExecArray)[1]);
    ctx.session.scene = 'edit_movie_code';
    ctx.session.editMovieId = movieId;
    await ctx.answerCbQuery();
    await ctx.editMessageText('✏️ Yangi kodni kiriting:', AdminKeyboard.cancelInline());
  });

  bot.action('cancel_edit', async (ctx) => {
    ctx.session = {} as any;
    await ctx.answerCbQuery('❌ Bekor qilindi');
    try { await ctx.deleteMessage(); } catch {}
  });

  bot.action(/^edit_cancel_(\d+)$/, async (ctx) => {
    ctx.session = {} as any;
    await ctx.answerCbQuery('❌ Bekor qilindi');
    try { await ctx.deleteMessage(); } catch {}
  });

  // ============ STATS ============
  bot.action(/^stats_movie_(\d+)$/, async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;

    const movieId = parseInt((ctx.match as RegExpExecArray)[1]);
    const stats = await svc.getMovieStats(botId, movieId);
    if (!stats) {
      await ctx.answerCbQuery('❌ Kino topilmadi!');
      return;
    }

    await ctx.answerCbQuery('📊 Statistika');
    await ctx.reply(
      `📊 Kino Statistikasi\n\n🎬 ${stats.title}\n📋 Kod: ${stats.code}\n\n` +
      `👁 Jami ko'rishlar: ${stats.totalViews}\n` +
      `👥 Noyob ko'ruvchilar: ${stats.uniqueViewers}\n` +
      `📅 Bugungi ko'rishlar: ${stats.todayViews}\n` +
      `📈 Haftalik ko'rishlar: ${stats.weeklyViews}\n\n` +
      `🕐 Oxirgi ko'rish: ${stats.lastViewedAt ? new Date(stats.lastViewedAt).toLocaleString('uz-UZ') : 'Hali ko\'rilmagan'}\n` +
      `📆 Qo'shilgan: ${new Date(stats.createdAt).toLocaleDateString('uz-UZ')}`
    );
  });

  // ============ PREMIERE ACTIONS ============
  bot.action(/^premiere_movie_(\d+)$/, async (ctx) => {
    const movieId = parseInt((ctx.match as RegExpExecArray)[1]);
    const movies = await svc.getPremiereMovies(botId);
    const isCurrentlyPremiere = movies.some(m => m.id === movieId);
    await svc.setMoviePremiere(botId, movieId, !isCurrentlyPremiere, movies.length);
    await ctx.answerCbQuery(isCurrentlyPremiere ? '❌ Premyeradan olib tashlandi' : '⭐ Premyera qilindi');
  });

  bot.action(/^premiere_up_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('⬆️ Yuqoriga ko\'tarildi');
  });

  bot.action(/^premiere_down_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('⬇️ Pastga tushirildi');
  });

  bot.action(/^premiere_remove_(\d+)$/, async (ctx) => {
    const movieId = parseInt((ctx.match as RegExpExecArray)[1]);
    await svc.setMoviePremiere(botId, movieId, false);
    await ctx.answerCbQuery('❌ Premyeradan olib tashlandi');
    try { await ctx.deleteMessage(); } catch {}
  });

  // ============ WEB APP DATA ============
  bot.on('web_app_data', async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    const message = ctx.message as any;
    if (!message.web_app_data) return;
    try {
      const data = JSON.parse(message.web_app_data.data);
      if (data.action === 'watch' && data.movieCode) {
        const { subscribed, unsubscribedChannels } = await svc.checkUserSubscription(botId, bot, user.id);
        if (!subscribed) {
          await ctx.reply('⚠️ Kinoni ko\'rish uchun barcha kanallarga obuna bo\'ling:', UserKeyboard.subscriptionButtons(unsubscribedChannels));
          return;
        }
        const movie = await svc.getMovieByCode(botId, data.movieCode);
        if (!movie) {
          await ctx.reply('❌ Kino topilmadi!');
          return;
        }
        await sendMovieMedia(ctx, movie);
        await svc.incrementMovieViews(botId, movie.id, user.id);
      }
    } catch (error) {
      console.error('Error parsing web app data:', error);
    }
  });

  // ============ TEXT ============
  bot.on('text', async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    const message = ctx.message as Message.TextMessage;
    const text = message.text;

    if (ctx.session?.scene === 'search_by_code') {
      const movie = await svc.getMovieByCode(botId, text);
      if (movie) {
        ctx.session = {} as any;
        let caption = `🎬 ${movie.title}\n\n`;
        if (movie.description) caption += `📝 ${movie.description}\n\n`;
        caption += `👁 Ko'rishlar: ${movie.views_count}\n`;
        caption += `📅 Qo'shilgan: ${movie.created_at.toLocaleDateString('uz-UZ')}`;
        if (movie.thumbnail_file_id) {
          await ctx.replyWithPhoto(movie.thumbnail_file_id, { caption, ...UserKeyboard.watchMovie(movie.code) });
        } else {
          await ctx.reply(caption, UserKeyboard.watchMovie(movie.code));
        }
      } else {
        await ctx.reply('❌ Bu kod bilan kino topilmadi. Qayta urinib ko\'ring:');
      }
      return;
    }

    if (ctx.session?.scene === 'upload_movie' && (await isAdmin(user.id))) {
      await handleUploadMovieScene(ctx, text);
      return;
    }

    if (ctx.session?.scene === 'edit_movie_title' && (await isAdmin(user.id))) {
      await svc.updateMovie(botId, ctx.session.editMovieId, { title: text });
      ctx.session = {} as any;
      await ctx.reply('✅ Kino nomi yangilandi!', AdminKeyboard.mainMenu());
      return;
    }

    if (ctx.session?.scene === 'edit_movie_description' && (await isAdmin(user.id))) {
      await svc.updateMovie(botId, ctx.session.editMovieId, { description: text });
      ctx.session = {} as any;
      await ctx.reply('✅ Kino tavsifi yangilandi!', AdminKeyboard.mainMenu());
      return;
    }

    if (ctx.session?.scene === 'edit_movie_code' && (await isAdmin(user.id))) {
      await svc.updateMovie(botId, ctx.session.editMovieId, { code: text.toUpperCase() });
      ctx.session = {} as any;
      await ctx.reply('✅ Kino kodi yangilandi!', AdminKeyboard.mainMenu());
      return;
    }

    // Maybe a movie code
    const movie = await svc.getMovieByCode(botId, text);
    if (movie) {
      const { subscribed, unsubscribedChannels } = await svc.checkUserSubscription(botId, bot, user.id);
      if (!subscribed) {
        await ctx.reply('⚠️ Kinoni ko\'rish uchun barcha kanallarga obuna bo\'ling:', UserKeyboard.subscriptionButtons(unsubscribedChannels));
        return;
      }
      let caption = `🎬 ${movie.title}\n\n`;
      if (movie.description) caption += `📝 ${movie.description}\n\n`;
      caption += `👁 Ko'rishlar: ${movie.views_count}`;
      if (movie.thumbnail_file_id) {
        await ctx.replyWithPhoto(movie.thumbnail_file_id, { caption, ...UserKeyboard.watchMovie(movie.code) });
      } else {
        await ctx.reply(caption, UserKeyboard.watchMovie(movie.code));
      }
    }
  });

  // ============ VIDEO/MEDIA (admin upload) ============
  // Telegram'da kino bir nechta turda yuborilishi mumkin:
  //   - video (oddiy video)
  //   - animation (GIF / qisqa video)
  //   - video_note (dumaloq video)
  //   - document (fayl sifatida yuborilgan video, mime_type: video/*)
  async function captureUploadMedia(
    ctx: BotContext,
    fileId: string,
    fileType: string,
    duration?: number,
    fileSize?: number,
    thumbId?: string,
  ) {
    if (ctx.session?.scene !== 'upload_movie' || ctx.session?.step !== 4) return false;
    ctx.session.movieData.file_id = fileId;
    ctx.session.movieData.file_type = fileType;
    if (duration !== undefined) ctx.session.movieData.duration = duration;
    if (fileSize !== undefined) ctx.session.movieData.file_size = fileSize;
    if (thumbId) ctx.session.movieData.auto_thumbnail_file_id = thumbId;
    ctx.session.step = 5;
    await ctx.reply('5️⃣ Thumbnail rasm yuboring (ixtiyoriy):', AdminKeyboard.skipOrCancel());
    return true;
  }

  bot.on('video', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    const v = (ctx.message as Message.VideoMessage).video;
    const handled = await captureUploadMedia(ctx, v.file_id, 'video', v.duration, v.file_size, v.thumbnail?.file_id);
    if (!handled && ctx.session?.scene === 'upload_movie') {
      await ctx.reply('⚠️ Avval boshqa qadamlarni to\'ldiring. Qayta boshlash uchun "❌ Bekor qilish" → "📤 Kino Yuklash".');
    }
  });

  bot.on('animation', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    const a = (ctx.message as any).animation;
    if (!a) return;
    await captureUploadMedia(ctx, a.file_id, 'animation', a.duration, a.file_size, a.thumbnail?.file_id);
  });

  bot.on('video_note', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    const vn = (ctx.message as any).video_note;
    if (!vn) return;
    await captureUploadMedia(ctx, vn.file_id, 'video_note', vn.duration, vn.file_size, vn.thumbnail?.file_id);
  });

  // Document — agar mime_type video/* bo'lsa
  bot.on('document', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    const doc = (ctx.message as any).document;
    if (!doc) return;
    if (ctx.session?.scene === 'upload_movie' && ctx.session?.step === 4) {
      const isVideo = (doc.mime_type || '').startsWith('video/');
      if (isVideo) {
        await captureUploadMedia(ctx, doc.file_id, 'document', undefined, doc.file_size, doc.thumbnail?.file_id);
      } else {
        await ctx.reply('⚠️ Video fayl yuboring (video yoki .mp4 hujjat).');
      }
    }
  });

  // ============ PHOTO (thumbnail) ============
  bot.on('photo', async (ctx) => {
    const user = ctx.from;
    if (!user || !(await isAdmin(user.id))) return;
    if (ctx.session?.scene === 'upload_movie' && ctx.session?.step === 5) {
      const message = ctx.message as Message.PhotoMessage;
      const photo = message.photo;
      const largestPhoto = photo[photo.length - 1];
      ctx.session.movieData.thumbnail_file_id = largestPhoto.file_id;
      ctx.session.step = 6;
      await ctx.reply('6️⃣ Bu kino premyera bo\'lsinmi?', AdminKeyboard.yesNo());
    }
  });
}
