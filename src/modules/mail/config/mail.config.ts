import { registerAs } from '@nestjs/config';

export interface MailConfig {
  apiKey: string;
  from: string;
  baseUrl?: string;
}

export const mailConfig = registerAs(
  'mail',
  (): MailConfig => ({
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.MAIL_FROM || 'noreply@example.com',
    baseUrl: process.env.RESEND_BASE_URL || 'https://api.resend.com',
  }),
);
