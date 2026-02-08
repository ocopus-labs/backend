import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';

export class SendEmailDto {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class SendWelcomeEmailDto {
  to: string;
  name: string;
}

export class SendPasswordResetDto {
  to: string;
  name: string;
  resetToken: string;
}

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    const result = await this.emailService.sendEmail(sendEmailDto);
    return {
      success: result,
      message: result ? 'Email sent successfully' : 'Failed to send email',
    };
  }

  @Post('welcome')
  async sendWelcomeEmail(@Body() welcomeDto: SendWelcomeEmailDto) {
    const result = await this.emailService.sendWelcomeEmail(
      welcomeDto.to,
      welcomeDto.name,
    );
    return {
      success: result,
      message: result
        ? 'Welcome email sent successfully'
        : 'Failed to send welcome email',
    };
  }

  @Post('password-reset')
  async sendPasswordResetEmail(@Body() resetDto: SendPasswordResetDto) {
    const result = await this.emailService.sendPasswordResetEmail(
      resetDto.to,
      resetDto.resetToken,
      resetDto.name,
    );
    return {
      success: result,
      message: result
        ? 'Password reset email sent successfully'
        : 'Failed to send password reset email',
    };
  }

  @Post('test')
  async testEmail(@Body() body: { to?: string }) {
    const to = body?.to || process.env.EMAIL_USER || 'test@example.com';
    const result = await this.emailService.sendEmail({
      to,
      subject: 'Test Email from Billing System',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from your billing system backend!</p>
        <p>If you received this email, your SMTP configuration is working correctly.</p>
      `,
    });

    return {
      success: result,
      message: result
        ? `Test email sent successfully to ${to}`
        : `Failed to send test email to ${to}`,
    };
  }
}
