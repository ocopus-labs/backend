import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailConfigService {
  constructor(private configService: ConfigService) {}

  get apiKey(): string {
    return this.configService.get<string>('RESEND_API_KEY', '');
  }

  get from(): string {
    return this.configService.get<string>('MAIL_FROM', 'noreply@example.com');
  }

  get baseUrl(): string {
    return this.configService.get<string>(
      'RESEND_BASE_URL',
      'https://api.resend.com',
    );
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
