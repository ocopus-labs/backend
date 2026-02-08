import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Resend } from 'resend';
import {
  SendEmailOptions,
  SendEmailResponse,
} from './interfaces/mail.interface';
import { MailConfigService } from './mail-config.service';
import {
  welcomeEmailTemplate,
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  passwordChangedEmailTemplate,
  notificationEmailTemplate,
  invoiceEmailTemplate,
  paymentReceiptTemplate,
  subscriptionActivatedTemplate,
  paymentSuccessTemplate,
  paymentFailedTemplate,
  subscriptionCancelledTemplate,
  trialEndingTemplate,
  type WelcomeEmailData,
  type VerificationEmailData,
  type PasswordResetEmailData,
  type PasswordChangedEmailData,
  type NotificationEmailData,
  type InvoiceData,
  type PaymentReceiptData,
  type SubscriptionActivatedData,
  type PaymentSuccessData,
  type PaymentFailedData,
  type SubscriptionCancelledData,
  type TrialEndingData,
  type TemplateConfig,
} from './templates';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend;
  private isConfigured = false;
  private templateConfig: Partial<TemplateConfig>;

  constructor(private mailConfigService: MailConfigService) {
    this.templateConfig = {
      appName: 'POS Platform',
      appUrl: this.mailConfigService.appUrl || 'http://localhost:5173',
      supportEmail: this.mailConfigService.from,
    };
  }

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

  // ============================================
  // Authentication & Transactional Emails
  // ============================================

  /**
   * Send a welcome email
   */
  async sendWelcomeEmail(
    email: string,
    data: Omit<WelcomeEmailData, 'email'>,
  ): Promise<SendEmailResponse> {
    const template = welcomeEmailTemplate({ ...data, email }, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send a verification email
   */
  async sendVerificationEmail(
    email: string,
    data: Omit<VerificationEmailData, 'email'>,
  ): Promise<SendEmailResponse> {
    const template = verificationEmailTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    data: Omit<PasswordResetEmailData, 'email'>,
  ): Promise<SendEmailResponse> {
    const template = passwordResetEmailTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send password changed confirmation email
   */
  async sendPasswordChangedEmail(
    email: string,
    data: PasswordChangedEmailData,
  ): Promise<SendEmailResponse> {
    const template = passwordChangedEmailTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send a notification email
   */
  async sendNotification(
    email: string,
    data: NotificationEmailData,
  ): Promise<SendEmailResponse> {
    const template = notificationEmailTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  // ============================================
  // Invoice & Payment Emails
  // ============================================

  /**
   * Send an invoice email
   */
  async sendInvoiceEmail(
    email: string,
    data: InvoiceData,
  ): Promise<SendEmailResponse> {
    const template = invoiceEmailTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send a payment receipt email
   */
  async sendPaymentReceiptEmail(
    email: string,
    data: PaymentReceiptData,
  ): Promise<SendEmailResponse> {
    const template = paymentReceiptTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  // ============================================
  // Subscription Emails
  // ============================================

  /**
   * Send subscription activated/upgraded email
   */
  async sendSubscriptionActivatedEmail(
    email: string,
    data: SubscriptionActivatedData,
  ): Promise<SendEmailResponse> {
    const template = subscriptionActivatedTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send payment success email
   */
  async sendPaymentSuccessEmail(
    email: string,
    data: PaymentSuccessData,
  ): Promise<SendEmailResponse> {
    const template = paymentSuccessTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send payment failed email
   */
  async sendPaymentFailedEmail(
    email: string,
    data: PaymentFailedData,
  ): Promise<SendEmailResponse> {
    const template = paymentFailedTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send subscription cancelled email
   */
  async sendSubscriptionCancelledEmail(
    email: string,
    data: SubscriptionCancelledData,
  ): Promise<SendEmailResponse> {
    const template = subscriptionCancelledTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send trial ending soon email
   */
  async sendTrialEndingEmail(
    email: string,
    data: TrialEndingData,
  ): Promise<SendEmailResponse> {
    const template = trialEndingTemplate(data, this.templateConfig);
    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}
