import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Resend } from 'resend';
import {
  SendEmailOptions,
  SendEmailResponse,
} from './interfaces/mail.interface';
import { MailConfigService } from './mail-config.service';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend;
  private isConfigured = false;

  constructor(private mailConfigService: MailConfigService) {}

  onModuleInit() {
    const apiKey = this.mailConfigService.apiKey;
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY is not set. Mail service will not work properly.',
      );
      this.isConfigured = false;
      return;
    }
    this.resend = new Resend(apiKey);
    this.isConfigured = true;
    this.logger.log('Mail service initialized successfully');
  }

  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new Error(
        'Mail service is not configured. Please set RESEND_API_KEY environment variable.',
      );
    }
  }

  /**
   * Send a single email
   * @param options Email options including to, subject, html, text
   * @returns Promise with send result
   */
  async send(options: SendEmailOptions): Promise<SendEmailResponse> {
    this.ensureConfigured();

    try {
      // At least one of html or text is required
      if (!options.html && !options.text) {
        throw new Error('Either html or text content is required');
      }

      const emailOptions: any = {
        from: this.mailConfigService.from,
        to: options.to,
        subject: options.subject,
        headers: options.headers,
      };

      // Add content - at least one is required
      if (options.html) {
        emailOptions.html = options.html;
      }
      if (options.text) {
        emailOptions.text = options.text;
      }

      // Add optional fields
      if (options.replyTo) {
        emailOptions.replyTo = options.replyTo;
      }
      if (options.cc) {
        emailOptions.cc = options.cc;
      }
      if (options.bcc) {
        emailOptions.bcc = options.bcc;
      }

      const response = await this.resend.emails.send(emailOptions);

      if (response.error) {
        this.logger.error(
          `Failed to send email to ${options.to}: ${response.error.message}`,
        );
        throw new Error(response.error.message);
      }

      this.logger.log(`Email sent successfully to ${options.to}`);
      return {
        success: true,
        id: response.data?.id,
        message: 'Email sent successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error sending email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Send bulk emails
   * @param emails Array of email options
   * @returns Promise with array of send results
   */
  async sendBulk(emails: SendEmailOptions[]): Promise<SendEmailResponse[]> {
    this.ensureConfigured();

    try {
      const results = await Promise.all(emails.map((email) => this.send(email)));
      return results;
    } catch (error) {
      this.logger.error(
        `Error sending bulk emails: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Send a welcome email
   * @param email User email
   * @param name User name
   */
  async sendWelcomeEmail(
    email: string,
    name: string,
  ): Promise<SendEmailResponse> {
    const html = `
      <h1>Welcome, ${name}!</h1>
      <p>Thank you for signing up. We're excited to have you on board.</p>
    `;

    return this.send({
      to: email,
      subject: 'Welcome to our platform!',
      html,
      text: `Welcome, ${name}! Thank you for signing up.`,
    });
  }

  /**
   * Send a verification email
   * @param email User email
   * @param verificationLink Verification link
   */
  async sendVerificationEmail(
    email: string,
    verificationLink: string,
  ): Promise<SendEmailResponse> {
    const html = `
      <h1>Verify Your Email</h1>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verificationLink}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `;

    return this.send({
      to: email,
      subject: 'Verify your email address',
      html,
      text: `Please verify your email by visiting: ${verificationLink}`,
    });
  }

  /**
   * Send a password reset email
   * @param email User email
   * @param resetLink Password reset link
   */
  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
  ): Promise<SendEmailResponse> {
    const html = `
      <h1>Reset Your Password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;

    return this.send({
      to: email,
      subject: 'Password reset request',
      html,
      text: `Reset your password by visiting: ${resetLink}`,
    });
  }

  /**
   * Send a notification email
   * @param email User email
   * @param title Notification title
   * @param message Notification message
   */
  async sendNotification(
    email: string,
    title: string,
    message: string,
  ): Promise<SendEmailResponse> {
    const html = `
      <h2>${title}</h2>
      <p>${message}</p>
    `;

    return this.send({
      to: email,
      subject: title,
      html,
      text: message,
    });
  }
}
