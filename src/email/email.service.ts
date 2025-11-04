import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor() {
    this.createTransporter();
  }

  private createTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '465'),
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('Email transporter verification failed:', error);
      } else {
        this.logger.log('Email server is ready to send messages');
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully: ${result.messageId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      return false;
    }
  }

  // Utility methods for common email types
  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Billing System!</h2>
        <p>Hi ${name},</p>
        <p>Welcome to our billing system. Your account has been successfully created.</p>
        <p>You can now start using our services to manage your restaurant billing efficiently.</p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <br>
        <p>Best regards,<br>The Billing System Team</p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'Welcome to Billing System',
      html,
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string, name: string): Promise<boolean> {
    const resetUrl = `${process.env.AUTH_BASE_URL}/reset-password?token=${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password for your Billing System account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
        </div>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <br>
        <p>Best regards,<br>The Billing System Team</p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'Password Reset Request',
      html,
    });
  }

  async sendOrderConfirmationEmail(
    to: string, 
    orderNumber: string, 
    customerName: string, 
    orderDetails: any
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Confirmation</h2>
        <p>Hi ${customerName},</p>
        <p>Thank you for your order! Your order has been confirmed.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Details</h3>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Total Amount:</strong> ₹${orderDetails.totalAmount}</p>
          <p><strong>Order Type:</strong> ${orderDetails.orderType}</p>
        </div>
        <p>We'll notify you when your order is ready.</p>
        <br>
        <p>Best regards,<br>The Restaurant Team</p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: `Order Confirmation - ${orderNumber}`,
      html,
    });
  }

  async sendInvoiceEmail(
    to: string,
    invoiceNumber: string,
    customerName: string,
    invoiceData: any
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice</h2>
        <p>Hi ${customerName},</p>
        <p>Please find your invoice attached below.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Invoice Details</h3>
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Total Amount:</strong> ₹${invoiceData.totalAmount}</p>
          <p><strong>Date:</strong> ${new Date(invoiceData.date).toLocaleDateString()}</p>
        </div>
        <p>Thank you for your business!</p>
        <br>
        <p>Best regards,<br>The Billing System Team</p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: `Invoice - ${invoiceNumber}`,
      html,
    });
  }
}