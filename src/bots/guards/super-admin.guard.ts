import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const tgId = req.headers['x-telegram-id'];
    const superAdminId = this.configService.get<string>('SUPER_ADMIN_TELEGRAM_ID');
    if (!tgId || !superAdminId) {
      throw new UnauthorizedException('Super admin huquqi talab qilinadi');
    }
    if (String(tgId) !== String(superAdminId)) {
      throw new UnauthorizedException('Faqat super admin uchun');
    }
    return true;
  }
}
