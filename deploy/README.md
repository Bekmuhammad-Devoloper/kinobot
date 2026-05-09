# Deploy ko'rsatmalari (DigitalOcean / Ubuntu)

Bu hujjat kinobotni Ubuntu serverga deploy qilish bo'yicha qisqa ko'rsatma.

## Talablar

- Ubuntu 20.04+ server (root yoki sudo huquqi bilan)
- Domain DNS A recordi server IP ga yo'naltirilgan bo'lishi
- SSH orqali kirish

## 1) Birinchi marta deploy

Server'ga SSH qiling:

```bash
ssh root@YOUR_SERVER_IP
```

So'ngra quyidagini bitta qatorda nusxalab yopishtiring (qiymatlarni o'zingiznikiga moslang):

```bash
export DOMAIN=cinema.bot.yuksalish.dev \
  ADMIN_EMAIL=bekmuhammad.devoloper@gmail.com \
  DB_PASSWORD=2006 \
  SUPER_ADMIN_TELEGRAM_ID=6340537709 \
  SUPER_ADMIN_LOGIN=admin \
  SUPER_ADMIN_PASSWORD='Bek2026!' \
  REPO_URL=https://github.com/Bekmuhammad-Devoloper/kinobot.git \
&& curl -fsSL https://raw.githubusercontent.com/Bekmuhammad-Devoloper/kinobot/main/deploy/setup-server.sh | bash
```

> 💡 `SUPER_ADMIN_LOGIN` va `SUPER_ADMIN_PASSWORD` — super-admin web paneliga kirish uchun. Keyinchalik o'zgartirish uchun `/opt/kinobot/.env` faylini tahrirlab `pm2 restart kinobot` qiling.

Skript:
- Node.js 20, PostgreSQL, Nginx, PM2, Certbot o'rnatadi
- DB yaratadi
- Code'ni `/opt/kinobot` ga clone qiladi
- `.env` faylini sozlaydi
- TypeScript build qiladi
- Birinchi run'da DB schema'ni yaratadi
- PM2 orqali ishga tushiradi (autorestart)
- Nginx reverse proxy + Let's Encrypt SSL sertifikati o'rnatadi

Tugagach:

```
✅ Deploy tugadi.
🌐 https://cinema.bot.yuksalish.dev/webapp/super-admin/
```

## 2) Yangilash

Code o'zgargandan keyin GitHub'ga push qiling, so'ngra serverda:

```bash
bash /opt/kinobot/deploy/update.sh
```

## 3) Foydalanish

### Super Admin (siz)
1. Telegram'da `@cinema_devbot` ga `/start` bering yoki har qanday botingizdan WebApp tugmasini ulang
2. Yoki to'g'ridan-to'g'ri brauzerda: `https://cinema.bot.yuksalish.dev/webapp/super-admin/`
3. Yangi mijoz boti qo'shing: token + nom + egasining Telegram ID + muddat (default 31 kun)
4. Bot avtomatik ishga tushadi
5. Muddatni cho'zish: +7/+30/+90 kun yoki maxsus

### Mijoz admin
- Ularning admin paneli: `https://cinema.bot.yuksalish.dev/webapp/admin/?bot=<BOT_ID>`
- Bot'da `/admin` buyrug'i orqali kiradi (egasi sifatida)

### Mijoz user
- O'z Telegram bot'iga kirib `/start` qiladi
- Premyera: `https://cinema.bot.yuksalish.dev/webapp/premiere/?bot=<BOT_ID>`

## 4) Foydali komandalar

```bash
# Loglar
pm2 logs kinobot --lines 100

# Status
pm2 status

# Restart
pm2 restart kinobot

# Stop
pm2 stop kinobot

# Sertifikat tekshirish
certbot certificates

# Nginx status
systemctl status nginx
nginx -t

# DB ga ulanish
sudo -u postgres psql kino_bot

# Botlar ro'yxati
sudo -u postgres psql kino_bot -c "SELECT id, name, username, expires_at, is_active FROM bots;"
```

## 5) License/muddat boshqaruvi (CLI orqali)

Agar Web UI ishlamayotgan bo'lsa, terminaldan ham boshqarsa bo'ladi:

```bash
# Botlar ro'yxati
curl -s https://cinema.bot.yuksalish.dev/api/super-admin/bots \
  -H "x-telegram-id: 6340537709" | python3 -m json.tool

# Yangi bot qo'shish
curl -X POST https://cinema.bot.yuksalish.dev/api/super-admin/bots \
  -H "x-telegram-id: 6340537709" \
  -H "Content-Type: application/json" \
  -d '{"token":"BOT_TOKEN","name":"Mijoz nomi","owner_telegram_id":12345,"duration_days":31}'

# +30 kun
curl -X POST https://cinema.bot.yuksalish.dev/api/super-admin/bots/1/extend \
  -H "x-telegram-id: 6340537709" \
  -H "Content-Type: application/json" \
  -d '{"days":30}'

# Pauza
curl -X PATCH https://cinema.bot.yuksalish.dev/api/super-admin/bots/1/active \
  -H "x-telegram-id: 6340537709" \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}'
```

## 6) DNS sozlash

DigitalOcean / yuksalish.dev panelida A recordini qo'shing:

```
Type: A
Name: cinema.bot
Value: 104.248.25.130
TTL: 300
```

DNS yangilanguncha 1-15 daqiqa kuting. Tekshirish:

```bash
dig cinema.bot.yuksalish.dev +short
```

## 7) Xavfsizlik

- `.env` fayli `chmod 600` bilan saqlanadi (faqat root o'qishi mumkin)
- Postgres faqat lokal portda tinglaydi
- Firewall (UFW) faqat 22/80/443 portlarini ochadi
- PM2 root'da emas, alohida user'da ishlatish maslahat beriladi (production uchun yaxshilash)
