import { Controller, Post, Body } from '@nestjs/common';
import { MailService } from './mail.service';
import type { SendEmailOptions } from './interfaces/mail.interface';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  /**
   * Send a single email
   * POST /mail/send
   * Body: { to: string, subject: string, html?: string, text?: string }
   */
  @Post('send')
  async send(@Body() options: SendEmailOptions) {
    return await this.mailService.send(options);
  }

  /**
   * Send a welcome email
   * POST /mail/welcome
   * Body: { email: string, name: string }
   */
  @Post('welcome')
  async sendWelcome(
    @Body() body: { email: string; name: string; dashboardUrl?: string },
  ) {
    return await this.mailService.sendWelcomeEmail(body.email, {
      userName: body.name,
      dashboardUrl: body.dashboardUrl || '/dashboard',
    });
  }

  /**
   * Send a verification email
   * POST /mail/verify
   * Body: { email: string, verificationLink: string, name?: string }
   */
  @Post('verify')
  async sendVerification(
    @Body() body: { email: string; verificationLink: string; name?: string },
  ) {
    return await this.mailService.sendVerificationEmail(body.email, {
      userName: body.name || 'User',
      verificationUrl: body.verificationLink,
    });
  }

  /**
   * Send a password reset email
   * POST /mail/reset-password
   * Body: { email: string, resetLink: string, name?: string }
   */
  @Post('reset-password')
  async sendPasswordReset(
    @Body() body: { email: string; resetLink: string; name?: string },
  ) {
    return await this.mailService.sendPasswordResetEmail(body.email, {
      userName: body.name || 'User',
      resetUrl: body.resetLink,
    });
  }

  /**
   * Send a notification email
   * POST /mail/notify
   * Body: { email: string, title: string, message: string, name?: string }
   */
  @Post('notify')
  async sendNotification(
    @Body()
    body: {
      email: string;
      title: string;
      message: string;
      name?: string;
    },
  ) {
    return await this.mailService.sendNotification(body.email, {
      userName: body.name || 'User',
      title: body.title,
      message: body.message,
    });
  }
}
