import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  private adminIds: number[];

  constructor(private readonly configService: ConfigService) {
    const adminIdsStr = this.configService.get('ADMIN_TELEGRAM_IDS', '');
    this.adminIds = adminIdsStr.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const telegramId = request.headers['x-telegram-id'];

    if (!telegramId || !this.adminIds.includes(parseInt(telegramId))) {
      throw new UnauthorizedException('Admin access required');
    }

    return true;
  }
}
