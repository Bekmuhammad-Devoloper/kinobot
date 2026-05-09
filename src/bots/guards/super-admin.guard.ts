import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // Login/parol asosida token tekshirish
    const adminToken = req.headers['x-admin-token'];
    if (adminToken) {
      const login = this.configService.get<string>('SUPER_ADMIN_LOGIN');
      const password = this.configService.get<string>('SUPER_ADMIN_PASSWORD');
      if (login && password) {
        const expectedToken = createHash('sha256').update(`${login}:${password}`).digest('hex');
        if (adminToken === expectedToken) return true;
      }
    }

    // Telegram ID asosida tekshirish (eskidan qolgan)
    const tgId = req.headers['x-telegram-id'];
    const superAdminId = this.configService.get<string>('SUPER_ADMIN_TELEGRAM_ID');
    if (tgId && superAdminId && String(tgId) === String(superAdminId)) {
      return true;
    }

    throw new UnauthorizedException('Super admin huquqi talab qilinadi');
  }
}
