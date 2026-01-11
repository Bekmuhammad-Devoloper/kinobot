import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebappService {
  constructor(private readonly configService: ConfigService) {}

  validateTelegramWebAppData(initData: string): { valid: boolean; data?: any } {
    try {
      const botToken = this.configService.get('TELEGRAM_BOT_TOKEN');
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');

      // Sort and create data check string
      const dataCheckArr: string[] = [];
      urlParams.sort();
      urlParams.forEach((value, key) => {
        dataCheckArr.push(`${key}=${value}`);
      });
      const dataCheckString = dataCheckArr.join('\n');

      // Create secret key
      const secretKey = createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      // Calculate hash
      const calculatedHash = createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      if (calculatedHash !== hash) {
        return { valid: false };
      }

      // Parse user data
      const userData = urlParams.get('user');
      const user = userData ? JSON.parse(userData) : null;

      return {
        valid: true,
        data: {
          user,
          authDate: urlParams.get('auth_date'),
          queryId: urlParams.get('query_id'),
        },
      };
    } catch (error) {
      return { valid: false };
    }
  }
}
