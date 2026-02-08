/**
 * Authentication and Transactional Email Templates
 */

import { baseTemplate, TemplateConfig } from './base.template';

/**
 * Welcome email template
 */
export interface WelcomeEmailData {
  userName: string;
  email: string;
  dashboardUrl: string;
  features?: string[];
}

export function welcomeEmailTemplate(
  data: WelcomeEmailData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const content = `
    <div class="section text-center">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; width: 64px; height: 64px; background-color: #dbeafe; border-radius: 50%; line-height: 64px; text-align: center;">
          <span style="color: #2563eb; font-size: 32px;">👋</span>
        </span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Welcome to POS Platform!
      </h2>
      <p class="text-muted">Hi ${data.userName}, we're excited to have you on board.</p>
    </div>

    <div class="card card-accent">
      <p style="color: #374151; font-size: 15px;">
        Your account has been created successfully. You're now ready to start managing your business with our powerful POS platform.
      </p>
    </div>

    ${
      data.features && data.features.length > 0
        ? `
    <div class="section">
      <h3 class="section-title">What You Can Do</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${data.features
          .map(
            (feature) => `
        <li style="padding: 8px 0; display: flex; align-items: center;">
          <span style="color: #4f46e5; margin-right: 12px; font-size: 16px;">→</span>
          <span style="color: #374151;">${feature}</span>
        </li>
        `,
          )
          .join('')}
      </ul>
    </div>
    `
        : `
    <div class="section">
      <h3 class="section-title">Get Started</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li style="padding: 8px 0; display: flex; align-items: center;">
          <span style="color: #4f46e5; margin-right: 12px; font-size: 16px;">1.</span>
          <span style="color: #374151;">Create your first business</span>
        </li>
        <li style="padding: 8px 0; display: flex; align-items: center;">
          <span style="color: #4f46e5; margin-right: 12px; font-size: 16px;">2.</span>
          <span style="color: #374151;">Add your menu items or products</span>
        </li>
        <li style="padding: 8px 0; display: flex; align-items: center;">
          <span style="color: #4f46e5; margin-right: 12px; font-size: 16px;">3.</span>
          <span style="color: #374151;">Start taking orders</span>
        </li>
      </ul>
    </div>
    `
    }

    <div class="section text-center mt-4">
      <a href="${data.dashboardUrl}" class="btn">
        Go to Dashboard
      </a>
      <p class="text-muted mt-4" style="font-size: 13px;">
        Need help getting started? Check out our documentation or contact support.
      </p>
    </div>
  `;

  const html = baseTemplate(
    content,
    {
      preheader: `Welcome to POS Platform, ${data.userName}! Let's get started.`,
    },
    config,
  );

  const text = `
Welcome to POS Platform!

Hi ${data.userName}, we're excited to have you on board.

Your account has been created successfully. You're now ready to start managing your business with our powerful POS platform.

Get Started:
1. Create your first business
2. Add your menu items or products
3. Start taking orders

Go to your dashboard: ${data.dashboardUrl}

Need help getting started? Check out our documentation or contact support.
  `.trim();

  return {
    html,
    text,
    subject: `Welcome to POS Platform, ${data.userName}!`,
  };
}

/**
 * Email verification template
 */
export interface VerificationEmailData {
  userName: string;
  verificationUrl: string;
  expiresIn?: string;
}

export function verificationEmailTemplate(
  data: VerificationEmailData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const expiresIn = data.expiresIn || '24 hours';

  const content = `
    <div class="section text-center">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; width: 64px; height: 64px; background-color: #dbeafe; border-radius: 50%; line-height: 64px; text-align: center;">
          <span style="color: #2563eb; font-size: 32px;">✉️</span>
        </span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Verify Your Email
      </h2>
      <p class="text-muted">Hi ${data.userName}, please confirm your email address.</p>
    </div>

    <div class="card card-accent">
      <p style="color: #374151; font-size: 15px;">
        Click the button below to verify your email address and activate your account.
        This link will expire in <strong>${expiresIn}</strong>.
      </p>
    </div>

    <div class="section text-center mt-4">
      <a href="${data.verificationUrl}" class="btn">
        Verify Email Address
      </a>
    </div>

    <div class="divider"></div>

    <div class="section">
      <p class="text-muted text-small">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="word-break: break-all; font-size: 13px; color: #4f46e5; margin-top: 8px;">
        ${data.verificationUrl}
      </p>
    </div>

    <div class="section">
      <p class="text-muted text-small text-center">
        If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
  `;

  const html = baseTemplate(
    content,
    {
      preheader: `Verify your email address to complete your registration`,
    },
    config,
  );

  const text = `
Verify Your Email

Hi ${data.userName}, please confirm your email address.

Click the link below to verify your email address and activate your account.
This link will expire in ${expiresIn}.

Verify Email: ${data.verificationUrl}

If you didn't create an account, you can safely ignore this email.
  `.trim();

  return {
    html,
    text,
    subject: 'Verify your email address',
  };
}

/**
 * Password reset template
 */
export interface PasswordResetEmailData {
  userName: string;
  resetUrl: string;
  expiresIn?: string;
  ipAddress?: string;
}

export function passwordResetEmailTemplate(
  data: PasswordResetEmailData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const expiresIn = data.expiresIn || '1 hour';

  const content = `
    <div class="section text-center">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; width: 64px; height: 64px; background-color: #fef3c7; border-radius: 50%; line-height: 64px; text-align: center;">
          <span style="color: #d97706; font-size: 32px;">🔐</span>
        </span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Reset Your Password
      </h2>
      <p class="text-muted">Hi ${data.userName}, we received a request to reset your password.</p>
    </div>

    <div class="card card-accent" style="border-left-color: #d97706;">
      <p style="color: #374151; font-size: 15px;">
        Click the button below to create a new password.
        This link will expire in <strong>${expiresIn}</strong>.
      </p>
    </div>

    <div class="section text-center mt-4">
      <a href="${data.resetUrl}" class="btn" style="background-color: #d97706;">
        Reset Password
      </a>
    </div>

    <div class="divider"></div>

    <div class="section">
      <p class="text-muted text-small">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="word-break: break-all; font-size: 13px; color: #4f46e5; margin-top: 8px;">
        ${data.resetUrl}
      </p>
    </div>

    <div class="card" style="background-color: #fef2f2; border-color: #fecaca;">
      <p style="color: #991b1b; font-size: 14px; margin: 0;">
        <strong>Didn't request this?</strong><br>
        If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.
      </p>
      ${
        data.ipAddress
          ? `
      <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">
        Request made from IP: ${data.ipAddress}
      </p>
      `
          : ''
      }
    </div>
  `;

  const html = baseTemplate(
    content,
    {
      preheader: `Reset your password - link expires in ${expiresIn}`,
    },
    config,
  );

  const text = `
Reset Your Password

Hi ${data.userName}, we received a request to reset your password.

Click the link below to create a new password. This link will expire in ${expiresIn}.

Reset Password: ${data.resetUrl}

Didn't request this?
If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.
${data.ipAddress ? `Request made from IP: ${data.ipAddress}` : ''}
  `.trim();

  return {
    html,
    text,
    subject: 'Reset your password',
  };
}

/**
 * Password changed confirmation template
 */
export interface PasswordChangedEmailData {
  userName: string;
  changedAt: Date;
  ipAddress?: string;
  supportUrl: string;
}

export function passwordChangedEmailTemplate(
  data: PasswordChangedEmailData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const changedAt = new Date(data.changedAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const content = `
    <div class="section text-center">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; width: 64px; height: 64px; background-color: #d1fae5; border-radius: 50%; line-height: 64px; text-align: center;">
          <span style="color: #059669; font-size: 32px;">✓</span>
        </span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Password Changed
      </h2>
      <p class="text-muted">Hi ${data.userName}, your password has been updated.</p>
    </div>

    <div class="card">
      <div class="info-row">
        <span class="info-label">Changed At</span>
        <span class="info-value">${changedAt}</span>
      </div>
      ${
        data.ipAddress
          ? `
      <div class="info-row">
        <span class="info-label">IP Address</span>
        <span class="info-value" style="font-family: monospace;">${data.ipAddress}</span>
      </div>
      `
          : ''
      }
    </div>

    <div class="card" style="background-color: #fef2f2; border-color: #fecaca;">
      <p style="color: #991b1b; font-size: 14px; margin: 0;">
        <strong>Wasn't you?</strong><br>
        If you didn't change your password, your account may have been compromised.
        Please contact support immediately.
      </p>
    </div>

    <div class="section text-center mt-4">
      <a href="${data.supportUrl}" class="btn btn-secondary">
        Contact Support
      </a>
    </div>
  `;

  const html = baseTemplate(
    content,
    {
      preheader: `Your password was changed on ${changedAt}`,
    },
    config,
  );

  const text = `
Password Changed

Hi ${data.userName}, your password has been updated.

Changed At: ${changedAt}
${data.ipAddress ? `IP Address: ${data.ipAddress}` : ''}

Wasn't you?
If you didn't change your password, your account may have been compromised.
Please contact support immediately: ${data.supportUrl}
  `.trim();

  return {
    html,
    text,
    subject: 'Your password has been changed',
  };
}

/**
 * Generic notification template
 */
export interface NotificationEmailData {
  userName: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export function notificationEmailTemplate(
  data: NotificationEmailData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const typeConfig = {
    info: { color: '#2563eb', bg: '#dbeafe', icon: 'ℹ️' },
    success: { color: '#059669', bg: '#d1fae5', icon: '✓' },
    warning: { color: '#d97706', bg: '#fef3c7', icon: '⚠️' },
    error: { color: '#dc2626', bg: '#fee2e2', icon: '!' },
  };
  const type = data.type || 'info';
  const cfg = typeConfig[type];

  const content = `
    <div class="section text-center">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; width: 64px; height: 64px; background-color: ${cfg.bg}; border-radius: 50%; line-height: 64px; text-align: center;">
          <span style="color: ${cfg.color}; font-size: 32px;">${cfg.icon}</span>
        </span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        ${data.title}
      </h2>
      <p class="text-muted">Hi ${data.userName}</p>
    </div>

    <div class="card card-accent" style="border-left-color: ${cfg.color};">
      <p style="color: #374151; font-size: 15px;">
        ${data.message}
      </p>
    </div>

    ${
      data.actionUrl && data.actionText
        ? `
    <div class="section text-center mt-4">
      <a href="${data.actionUrl}" class="btn" style="background-color: ${cfg.color};">
        ${data.actionText}
      </a>
    </div>
    `
        : ''
    }
  `;

  const html = baseTemplate(
    content,
    {
      preheader: data.message.substring(0, 100),
    },
    config,
  );

  const text = `
${data.title}

Hi ${data.userName},

${data.message}

${data.actionUrl ? `${data.actionText}: ${data.actionUrl}` : ''}
  `.trim();

  return {
    html,
    text,
    subject: data.title,
  };
}
