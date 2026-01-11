# 🎬 KinoBot - Telegram Kino Bot

Admin tomonidan boshqariladigan, kod orqali kino yuklash va ko'rsatish tizimi.

## 📋 Xususiyatlar

### User Qismi
- ✅ Majburiy obuna tizimi
- 🔍 Kod orqali kino qidirish
- 🎬 Premyera kinolarni ko'rish (Web App)
- 📊 Shaxsiy statistika

### Admin Qismi
- 📤 Kino yuklash (multi-step wizard)
- 📋 Kinolar ro'yxatini boshqarish
- ⭐ Premyera sozlash
- 📢 Majburiy obuna kanallarni boshqarish
- 👥 Userlar statistikasi
- 📊 Dashboard

## 🛠 Texnologiyalar

- **Backend:** Node.js, NestJS
- **Database:** PostgreSQL
- **Bot:** Telegraf, nestjs-telegraf
- **ORM:** TypeORM
- **Frontend:** Vanilla HTML/CSS/JS (Telegram Web App)

## 📦 O'rnatish

### 1. Repository'ni klonlash
```bash
git clone <repository-url>
cd KinoBot
```

### 2. Dependencylarni o'rnatish
```bash
npm install
```

### 3. Environment sozlash
`.env.example` faylini `.env` ga nusxalang va o'z ma'lumotlaringizni kiriting:

```bash
cp .env.example .env
```

### 4. Database yaratish
PostgreSQL'da yangi database yarating:
```sql
CREATE DATABASE kino_bot;
```

### 5. Botni ishga tushirish

Development:
```bash
npm run start:dev
```

Production:
```bash
npm run build
npm run start:prod
```

## ⚙️ Environment Variables

| Variable | Tavsif | Misol |
|----------|--------|-------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot tokeni | `123456:ABC...` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `password` |
| `DB_DATABASE` | Database nomi | `kino_bot` |
| `ADMIN_TELEGRAM_IDS` | Admin ID'lari (vergul bilan) | `123456789,987654321` |
| `WEB_APP_URL` | Web App URL | `https://yourdomain.com/webapp` |
| `PORT` | Server port | `3000` |

## 📁 Loyiha Strukturasi

```
src/
├── main.ts                 # Entry point
├── app.module.ts           # Asosiy modul
├── telegram/               # Telegram bot
│   ├── telegram.module.ts
│   ├── telegram.service.ts
│   ├── telegram.update.ts
│   └── keyboards/
├── database/               # Database entities
│   ├── database.module.ts
│   └── entities/
├── movies/                 # Kinolar moduli
├── users/                  # Userlar moduli
├── channels/               # Kanallar moduli
├── admin/                  # Admin moduli
└── webapp/                 # Web App moduli

public/
└── webapp/                 # Frontend fayllar
    ├── premiere/           # User Web App
    └── admin/              # Admin Web App
```

## 🔌 API Endpoints

### Public APIs
- `GET /api/movies/premiere` - Premyera kinolar
- `GET /api/movies/by-code/:code` - Kod bo'yicha kino
- `POST /api/movies/:id/view` - Ko'rishni qayd etish

### Admin APIs
- `GET /api/admin/stats/dashboard` - Dashboard statistika
- `GET /api/admin/movies` - Barcha kinolar
- `POST /api/admin/movies` - Yangi kino qo'shish
- `PUT /api/admin/movies/:id` - Kinoni tahrirlash
- `DELETE /api/admin/movies/:id` - Kinoni o'chirish
- `GET /api/admin/channels` - Kanallar ro'yxati
- `POST /api/admin/channels` - Yangi kanal qo'shish
- `GET /api/admin/users` - Userlar ro'yxati

## 🚀 Deploy

### PM2 bilan
```bash
npm run build
pm2 start dist/main.js --name "kinobot"
```

### Docker bilan
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/main.js"]
```

## 📝 Bot Buyruqlari

### User buyruqlari
- `/start` - Botni boshlash
- Kino kodi yuboring - Kinoni qidirish

### Admin buyruqlari
- `/admin` - Admin panel

## 📊 Database Schema

```sql
-- Admins
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    full_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    full_name VARCHAR(255),
    is_subscribed BOOLEAN DEFAULT FALSE,
    last_subscription_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Required Channels
CREATE TABLE required_channels (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(255) UNIQUE NOT NULL,
    channel_username VARCHAR(255),
    channel_title VARCHAR(255),
    invite_link TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Movies
CREATE TABLE movies (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_id VARCHAR(500) NOT NULL,
    file_type VARCHAR(20) DEFAULT 'video',
    thumbnail_file_id VARCHAR(500),
    duration INTEGER,
    file_size BIGINT,
    is_premiere BOOLEAN DEFAULT FALSE,
    premiere_order INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    uploaded_by BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Views
CREATE TABLE user_views (
    id SERIAL PRIMARY KEY,
    user_id BIGINT,
    movie_id INTEGER,
    viewed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);
```

## 📞 Aloqa

Savol va takliflar uchun: [@your_username](https://t.me/your_username)

## 📄 Litsenziya

MIT License
