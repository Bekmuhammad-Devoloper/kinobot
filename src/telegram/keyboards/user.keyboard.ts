import { Markup } from 'telegraf';
import { Channel } from '../../database/entities';

export const UserKeyboard = {
  // Asosiy menyu (web app url bilan)
  mainMenu: (webAppUrl?: string) => {
    if (webAppUrl) {
      return Markup.keyboard([
        [Markup.button.webApp('🎬 Premyera Kinolar', webAppUrl)],
        ['🔍 Kod orqali ko\'rish'],
        ['📊 Mening statistikam', 'ℹ️ Yordam'],
      ]).resize();
    }
    return Markup.keyboard([
      ['🎬 Premyera Kinolar', '🔍 Kod orqali ko\'rish'],
      ['📊 Mening statistikam', 'ℹ️ Yordam'],
    ]).resize();
  },

  // Majburiy obuna tugmalari
  subscriptionButtons: (channels: Channel[]) => {
    const urlButtons = channels.map((channel) => [
      Markup.button.url(
        `📢 ${channel.channel_title || channel.channel_username}`,
        channel.invite_link || `https://t.me/${channel.channel_username?.replace('@', '')}`
      ),
    ]);
    const checkButton = [[Markup.button.callback('✅ Tekshirish', 'check_subscription')]];
    return Markup.inlineKeyboard([...urlButtons, ...checkButton]);
  },

  // Kino ko'rish tugmasi
  watchMovie: (movieCode: string) => {
    return Markup.inlineKeyboard([
      [Markup.button.callback('▶️ Ko\'rish', `watch_${movieCode}`)],
    ]);
  },

  // Web App tugmasi
  premiereWebApp: (webAppUrl: string) => {
    return Markup.inlineKeyboard([
      [Markup.button.webApp('🎬 Premyera Kinolar', webAppUrl)],
    ]);
  },

  // Orqaga tugmasi
  back: () => {
    return Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Orqaga', 'back_to_menu')],
    ]);
  },
};
