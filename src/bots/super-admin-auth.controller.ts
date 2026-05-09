import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

@Controller('super-admin')
export class SuperAdminAuthController {
  constructor(private readonly configService: ConfigService) {}

  @Post('login')
  login(@Body() body: { login: string; password: string }) {
    const expectedLogin = this.configService.get<string>('SUPER_ADMIN_LOGIN');
    const expectedPassword = this.configService.get<string>('SUPER_ADMIN_PASSWORD');

    if (
      !expectedLogin ||
      !expectedPassword ||
      body.login !== expectedLogin ||
      body.password !== expectedPassword
    ) {
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }

    const token = createHash('sha256')
      .update(`${expectedLogin}:${expectedPassword}`)
      .digest('hex');

    return { success: true, token };
  }
}
