#!/bin/bash
# Ubuntu serverda kinobot ni deploy qiladi.
# Foydalanish:
#   1) Domain DNS A recordi server IP ga ulangan bo'lsin (cinema.bot.yuksalish.dev -> 104.248.25.130)
#   2) Quyidagi env o'zgaruvchilarni kiriting va skriptni ishga tushiring:
#        export DOMAIN=cinema.bot.yuksalish.dev
#        export ADMIN_EMAIL=you@example.com           # ixtiyoriy (Let's Encrypt uchun)
#        export DB_PASSWORD=2006
#        export SUPER_ADMIN_TELEGRAM_ID=6340537709
#        export SUPER_ADMIN_LOGIN=admin               # web panel'ga kirish uchun
#        export SUPER_ADMIN_PASSWORD=Bek2026!         # web panel'ga kirish uchun
#        export REPO_URL=https://github.com/Bekmuhammad-Devoloper/kinobot.git
#        bash deploy/setup-server.sh
#
# Skript idempotent — qayta ishga tushirsangiz, faqat o'zgarganlar yangilanadi.

set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN env required}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD env required}"
SUPER_ADMIN_TELEGRAM_ID="${SUPER_ADMIN_TELEGRAM_ID:?SUPER_ADMIN_TELEGRAM_ID env required}"
SUPER_ADMIN_LOGIN="${SUPER_ADMIN_LOGIN:-admin}"
SUPER_ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD:?SUPER_ADMIN_PASSWORD env required}"
REPO_URL="${REPO_URL:-https://github.com/Bekmuhammad-Devoloper/kinobot.git}"
APP_DIR="${APP_DIR:-/opt/kinobot}"
NODE_VERSION="${NODE_VERSION:-20}"

log() { echo -e "\n\033[1;36m=== $* ===\033[0m"; }

log "1/8 System update"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git ufw build-essential ca-certificates gnupg

log "2/8 Node.js ${NODE_VERSION}"
if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt "$NODE_VERSION" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

log "3/8 PM2"
npm i -g pm2

log "4/8 PostgreSQL"
if ! command -v psql >/dev/null; then
  apt-get install -y postgresql postgresql-contrib
  systemctl enable --now postgresql
fi

# Create DB + user (idempotent)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='kinobot'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER kinobot WITH PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='kino_bot'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE kino_bot OWNER kinobot;"
sudo -u postgres psql -c "ALTER USER kinobot WITH PASSWORD '${DB_PASSWORD}';"

log "5/8 Application code"
if [[ ! -d "$APP_DIR/.git" ]]; then
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" reset --hard origin/main
fi

cd "$APP_DIR"

cat > .env <<EOF
SUPER_ADMIN_TELEGRAM_ID=${SUPER_ADMIN_TELEGRAM_ID}
SUPER_ADMIN_LOGIN=${SUPER_ADMIN_LOGIN}
SUPER_ADMIN_PASSWORD=${SUPER_ADMIN_PASSWORD}

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=kinobot
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=kino_bot

WEB_APP_URL=https://${DOMAIN}/webapp
ADMIN_WEB_APP_URL=https://${DOMAIN}/webapp/admin

NODE_ENV=production
PORT=3000
EOF
chmod 600 .env

log "Building project"
npm ci --no-audit --no-fund
npm run build

log "6/8 PM2 service"
pm2 delete kinobot 2>/dev/null || true
pm2 start dist/main.js --name kinobot --time --update-env
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

log "7/8 Nginx + SSL"
apt-get install -y nginx certbot python3-certbot-nginx
ufw allow 'Nginx Full' || true
ufw allow OpenSSH || true

cat > /etc/nginx/sites-available/kinobot <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/kinobot /etc/nginx/sites-enabled/kinobot
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Get SSL cert (will modify nginx config to add 443 + redirect)
if [[ -n "${ADMIN_EMAIL}" ]]; then
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${ADMIN_EMAIL}" --redirect || true
else
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect || true
fi
systemctl reload nginx

log "8/8 Done"
pm2 status
echo
echo "✅ Deploy tugadi."
echo "🌐 https://${DOMAIN}/webapp/super-admin/"
echo "🔐 Login:       ${SUPER_ADMIN_LOGIN}"
echo "🔐 Parol:       ${SUPER_ADMIN_PASSWORD}"
echo "📋 PM2 loglar:  pm2 logs kinobot"
echo "🔄 Yangilash:   bash $APP_DIR/deploy/update.sh"
