import { Markup } from 'telegraf';
import { Movie } from '../../database/entities';

export const AdminKeyboard = {
  // Admin asosiy menyu
  mainMenu: () => {
    return Markup.keyboard([
      ['📤 Kino Yuklash', '📋 Kinolar Ro\'yxati'],
      ['⭐ Premyera Sozlash', '📢 Kanallar Boshqaruvi'],
      ['👥 Userlar Statistikasi', '📊 Umumiy Statistika'],
      ['⬅️ User Rejimiga'],
    ]).resize();
  },

  // Bekor qilish tugmasi
  cancel: () => {
    return Markup.keyboard([['❌ Bekor qilish']]).resize();
  },

  // Inline bekor qilish tugmasi
  cancelInline: () => {
    return Markup.inlineKeyboard([
      [Markup.button.callback('❌ Bekor qilish', 'cancel_edit')],
    ]);
  },

  // Skip yoki davom etish
  skipOrCancel: () => {
    return Markup.keyboard([['⏭ O\'tkazib yuborish'], ['❌ Bekor qilish']]).resize();
  },

  // Ha/Yo'q tanlash
  yesNo: () => {
    return Markup.keyboard([['✅ Ha', '❌ Yo\'q'], ['❌ Bekor qilish']]).resize();
  },

  // Kinolar ro'yxati inline tugmalari
  movieActions: (movieId: number) => {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✏️ Tahrirlash', `edit_movie_${movieId}`),
        Markup.button.callback('🗑 O\'chirish', `delete_movie_${movieId}`),
      ],
      [
        Markup.button.callback('📊 Statistika', `stats_movie_${movieId}`),
        Markup.button.callback('⭐ Premyera', `premiere_movie_${movieId}`),
      ],
    ]);
  },

  // Kinolar pagination
  moviesPagination: (currentPage: number, totalPages: number) => {
    const buttons = [];
    if (currentPage > 1) {
      buttons.push(Markup.button.callback('⬅️ Oldingi', `movies_page_${currentPage - 1}`));
    }
    if (currentPage < totalPages) {
      buttons.push(Markup.button.callback('Keyingi ➡️', `movies_page_${currentPage + 1}`));
    }
    return buttons.length > 0 ? Markup.inlineKeyboard([buttons]) : null;
  },

  // Premyera sozlash
  premiereActions: (movie: Movie) => {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('⬆️', `premiere_up_${movie.id}`),
        Markup.button.callback('⬇️', `premiere_down_${movie.id}`),
        Markup.button.callback('❌', `premiere_remove_${movie.id}`),
      ],
    ]);
  },

  // O'chirishni tasdiqlash
  confirmDelete: (movieId: number) => {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Ha, o\'chirish', `confirm_delete_${movieId}`),
        Markup.button.callback('❌ Yo\'q', `cancel_delete`),
      ],
    ]);
  },

  // Kinoni tahrirlash tugmalari
  editMovieOptions: (movieId: number) => {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🎬 Nomni o\'zgartirish', `edit_title_${movieId}`),
      ],
      [
        Markup.button.callback('📝 Tavsifni o\'zgartirish', `edit_description_${movieId}`),
      ],
      [
        Markup.button.callback('📋 Kodni o\'zgartirish', `edit_code_${movieId}`),
      ],
      [
        Markup.button.callback('❌ Bekor qilish', `edit_cancel_${movieId}`),
      ],
    ]);
  },

  // Kanallar Web App
  channelsWebApp: (webAppUrl: string) => {
    return Markup.inlineKeyboard([
      [Markup.button.webApp('📢 Kanallar Boshqaruvi', webAppUrl)],
    ]);
  },

  // Userlar Web App
  usersWebApp: (webAppUrl: string) => {
    return Markup.inlineKeyboard([
      [Markup.button.webApp('👥 Userlar Ro\'yxati', webAppUrl)],
    ]);
  },
};
