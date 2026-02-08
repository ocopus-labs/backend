/**
 * Subscription Email Templates
 */

import { baseTemplate, TemplateConfig } from './base.template';

export interface SubscriptionPlanInfo {
  name: string;
  displayName: string;
  priceMonthly: number;
  features?: string[];
}

function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Subscription activated/upgraded email
 */
export interface SubscriptionActivatedData {
  userName: string;
  plan: SubscriptionPlanInfo;
  billingPeriodEnd: Date;
  dashboardUrl: string;
  currency?: string;
}

export function subscriptionActivatedTemplate(
  data: SubscriptionActivatedData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const currency = data.currency || 'INR';

  const content = `
    <div class="section text-center">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; width: 64px; height: 64px; background-color: #dbeafe; border-radius: 50%; line-height: 64px; text-align: center;">
          <span style="color: #2563eb; font-size: 32px;">🎉</span>
        </span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Welcome to ${data.plan.displayName}!
      </h2>
      <p class="text-muted">Hi ${data.userName}, your subscription is now active.</p>
    </div>

    <div class="card" style="text-align: center;">
      <p class="text-muted text-small" style="margin-bottom: 4px;">Your Plan</p>
      <p style="font-size: 24px; font-weight: 700; color: #111827; margin: 8px 0;">
        ${data.plan.displayName}
      </p>
      <p style="font-size: 18px; color: #4f46e5; font-weight: 600;">
        ${formatCurrency(data.plan.priceMonthly, currency)}/month
      </p>
    </div>

    ${
      data.plan.features && data.plan.features.length > 0
        ? `
    <div class="section">
      <h3 class="section-title">What's Included</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${data.plan.features
          .map(
            (feature) => `
        <li style="padding: 8px 0; display: flex; align-items: center;">
          <span style="color: #059669; margin-right: 12px; font-size: 16px;">✓</span>
          <span style="color: #374151;">${feature}</span>
        </li>
        `,
          )
          .join('')}
      </ul>
    </div>
    `
        : ''
    }

    <div class="card">
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value"><span class="badge badge-success">ACTIVE</span></span>
      </div>
      <div class="info-row">
        <span class="info-label">Next Billing Date</span>
        <span class="info-value">${formatDate(data.billingPeriodEnd)}</span>
      </div>
    </div>

    <div class="section text-center mt-4">
      <a href="${data.dashboardUrl}" class="btn">
        Go to Dashboard
      </a>
      <p class="text-muted mt-4" style="font-size: 13px;">
        You can manage your subscription settings anytime from your account.
      </p>
    </div>
  `;

  const html = baseTemplate(
    content,
    {
      preheader: `Your ${data.plan.displayName} subscription is now active!`,
    },
    config,
  );

  const text = `
Welcome to ${data.plan.displayName}!

Hi ${data.userName}, your subscription is now active.

Your Plan: ${data.plan.displayName}
Price: ${formatCurrency(data.plan.priceMonthly, currency)}/month
Status: Active
Next Billing Date: ${formatDate(data.billingPeriodEnd)}

${
  data.plan.features && data.plan.features.length > 0
    ? `
What's Included:
${data.plan.features.map((f) => `- ${f}`).join('\n')}
`
    : ''
}

Visit your dashboard: ${data.dashboardUrl}

You can manage your subscription settings anytime from your account.
  `.trim();

  return {
    html,
    text,
    subject: `Welcome to ${data.plan.displayName} - Your subscription is active!`,
  };
}

/**
 * Payment successful email
 */
export interface PaymentSuccessData {
  userName: string;
  amount: number;
  planName: string;
  invoiceNumber: string;
  paymentDate: Date;
  nextBillingDate: Date;
  portalUrl: string;
  currency?: string;
}

export function paymentSuccessTemplate(
  data: PaymentSuccessData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const currency = data.currency || 'INR';

  const content = `
    <div class="section text-center">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; width: 64px; height: 64px; background-color: #d1fae5; border-radius: 50%; line-height: 64px; text-align: center;">
          <span style="color: #059669; font-size: 32px;">✓</span>
        </span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Payment Successful
      </h2>
      <p class="text-muted">Hi ${data.userName}, we've received your payment.</p>
    </div>

    <div class="card" style="text-align: center;">
      <p class="text-muted text-small" style="margin-bottom: 4px;">Amount Paid</p>
      <p style="font-size: 32px; font-weight: 700; color: #059669; margin: 8px 0;">
        ${formatCurrency(data.amount, currency)}
      </p>
      <p class="text-muted text-small">for ${data.planName}</p>
    </div>

    <div class="card">
      <div class="info-row">
        <span class="info-label">Invoice Number</span>
        <span class="info-value">${data.invoiceNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Payment Date</span>
        <span class="info-value">${formatDate(data.paymentDate)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Next Billing Date</span>
        <span class="info-value">${formatDate(data.nextBillingDate)}</span>
      </div>
    </div>

    <div class="section text-center mt-4">
      <a href="${data.portalUrl}" class="btn btn-secondary">
        View Billing History
      </a>
      <p class="text-muted mt-4" style="font-size: 13px;">
        Thank you for your continued subscription!
      </p>
    </div>
  `;

  const html = baseTemplate(
    content,
    {
      preheader: `Payment of ${formatCurrency(data.amount, currency)} received for ${data.planName}`,
    },
    config,
  );

  const text = `
Payment Successful

Hi ${data.userName}, we've received your payment.

Amount Paid: ${formatCurrency(data.amount, currency)}
Plan: ${data.planName}

Invoice Number: ${data.invoiceNumber}
Payment Date: ${formatDate(data.paymentDate)}
Next Billing Date: ${formatDate(data.nextBillingDate)}

View billing history: ${data.portalUrl}

Thank you for your continued subscription!
  `.trim();

  return {
    html,
    text,
    subject: `Payment received - ${formatCurrency(data.amount, currency)} for ${data.planName}`,
  };
}

/**
 * Payment failed email
 */
export interface PaymentFailedData {
  userName: string;
  amount: number;
  planName: string;
  failureReason?: string;
  retryDate?: Date;
  updatePaymentUrl: string;
  currency?: string;
}

export function paymentFailedTemplate(
  data: PaymentFailedData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const currency = data.currency || 'INR';

  const content = `
    <div class="section text-center">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; width: 64px; height: 64px; background-color: #fee2e2; border-radius: 50%; line-height: 64px; text-align: center;">
          <span style="color: #dc2626; font-size: 32px;">!</span>
        </span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Payment Failed
      </h2>
      <p class="text-muted">Hi ${data.userName}, we couldn't process your payment.</p>
    </div>

    <div class="card card-accent" style="border-left-color: #dc2626;">
      <p style="color: #374151; margin-bottom: 8px;">
        We attempted to charge <strong>${formatCurrency(data.amount, currency)}</strong> for your <strong>${data.planName}</strong> subscription, but the payment was unsuccessful.
      </p>
      ${
        data.failureReason
          ? `
      <p class="text-muted text-small">
        Reason: ${data.failureReason}
      </p>
      `
          : ''
      }
    </div>

    <div class="card">
      <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px;">
        What happens next?
      </h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li style="padding: 8px 0; display: flex; align-items: flex-start;">
          <span style="color: #4f46e5; margin-right: 12px; font-weight: 600;">1.</span>
          <span style="color: #374151;">Update your payment method to avoid service interruption</span>
        </li>
        ${
          data.retryDate
            ? `
        <li style="padding: 8px 0; display: flex; align-items: flex-start;">
          <span style="color: #4f46e5; margin-right: 12px; font-weight: 600;">2.</span>
          <span style="color: #374151;">We'll automatically retry the payment on ${formatDate(data.retryDate)}</span>
        </li>
        `
            : ''
        }
        <li style="padding: 8px 0; display: flex; align-items: flex-start;">
          <span style="color: #4f46e5; margin-right: 12px; font-weight: 600;">${data.retryDate ? '3' : '2'}.</span>
          <span style="color: #374151;">If payment continues to fail, your subscription will be paused</span>
        </li>
      </ul>
    </div>

    <div class="section text-center mt-4">
      <a href="${data.updatePaymentUrl}" class="btn" style="background-color: #dc2626;">
        Update Payment Method
      </a>
      <p class="text-muted mt-4" style="font-size: 13px;">
        Need help? Contact our support team.
      </p>
    </div>
  `;

  const html = baseTemplate(
    content,
    {
      preheader: `Action required: Your ${data.planName} payment failed`,
    },
    config,
  );

  const text = `
Payment Failed

Hi ${data.userName}, we couldn't process your payment.

We attempted to charge ${formatCurrency(data.amount, currency)} for your ${data.planName} subscription, but the payment was unsuccessful.
${data.failureReason ? `Reason: ${data.failureReason}` : ''}

What happens next?
1. Update your payment method to avoid service interruption
${data.retryDate ? `2. We'll automatically retry the payment on ${formatDate(data.retryDate)}` : ''}
${data.retryDate ? '3' : '2'}. If payment continues to fail, your subscription will be paused

Update payment method: ${data.updatePaymentUrl}

Need help? Contact our support team.
  `.trim();

  return {
    html,
    text,
    subject: `Action required: Payment failed for ${data.planName}`,
  };
}

/**
 * Subscription cancelled email
 */
export interface SubscriptionCancelledData {
  userName: string;
  planName: string;
  endDate: Date;
  reason?: string;
  reactivateUrl: string;
}

export function subscriptionCancelledTemplate(
  data: SubscriptionCancelledData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const content = `
    <div class="section text-center">
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Subscription Cancelled
      </h2>
      <p class="text-muted">Hi ${data.userName}, your subscription has been cancelled.</p>
    </div>

    <div class="card">
      <div class="info-row">
        <span class="info-label">Plan</span>
        <span class="info-value">${data.planName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value"><span class="badge badge-warning">CANCELLED</span></span>
      </div>
      <div class="info-row">
        <span class="info-label">Access Until</span>
        <span class="info-value">${formatDate(data.endDate)}</span>
      </div>
    </div>

    <div class="card card-accent">
      <p style="color: #374151;">
        You'll continue to have access to your ${data.planName} features until <strong>${formatDate(data.endDate)}</strong>.
        After that, your account will be downgraded to the Free plan.
      </p>
    </div>

    <div class="section text-center mt-4">
      <p class="text-muted mb-4">Changed your mind? You can reactivate anytime.</p>
      <a href="${data.reactivateUrl}" class="btn btn-success">
        Reactivate Subscription
      </a>
    </div>

    <div class="section mt-4">
      <p class="text-muted text-small text-center">
        We'd love to hear why you cancelled. Your feedback helps us improve.
        Simply reply to this email to share your thoughts.
      </p>
    </div>
  `;

  const html = baseTemplate(
    content,
    {
      preheader: `Your ${data.planName} subscription has been cancelled`,
    },
    config,
  );

  const text = `
Subscription Cancelled

Hi ${data.userName}, your subscription has been cancelled.

Plan: ${data.planName}
Status: Cancelled
Access Until: ${formatDate(data.endDate)}

You'll continue to have access to your ${data.planName} features until ${formatDate(data.endDate)}.
After that, your account will be downgraded to the Free plan.

Changed your mind? Reactivate here: ${data.reactivateUrl}

We'd love to hear why you cancelled. Your feedback helps us improve.
Simply reply to this email to share your thoughts.
  `.trim();

  return {
    html,
    text,
    subject: `Your ${data.planName} subscription has been cancelled`,
  };
}

/**
 * Trial ending soon email
 */
export interface TrialEndingData {
  userName: string;
  planName: string;
  trialEndDate: Date;
  priceMonthly: number;
  upgradeUrl: string;
  features?: string[];
  currency?: string;
}

export function trialEndingTemplate(
  data: TrialEndingData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const currency = data.currency || 'INR';
  const daysLeft = Math.ceil(
    (new Date(data.trialEndDate).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24),
  );

  const content = `
    <div class="section text-center">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; width: 64px; height: 64px; background-color: #fef3c7; border-radius: 50%; line-height: 64px; text-align: center;">
          <span style="color: #d97706; font-size: 32px;">⏰</span>
        </span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Your Trial Ends ${daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} Days`}
      </h2>
      <p class="text-muted">Hi ${data.userName}, don't lose access to ${data.planName}!</p>
    </div>

    <div class="card" style="text-align: center;">
      <p class="text-muted text-small" style="margin-bottom: 4px;">Trial Ends On</p>
      <p style="font-size: 20px; font-weight: 600; color: #d97706; margin: 8px 0;">
        ${formatDate(data.trialEndDate)}
      </p>
    </div>

    ${
      data.features && data.features.length > 0
        ? `
    <div class="section">
      <h3 class="section-title">Keep These Features</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${data.features
          .slice(0, 5)
          .map(
            (feature) => `
        <li style="padding: 8px 0; display: flex; align-items: center;">
          <span style="color: #059669; margin-right: 12px; font-size: 16px;">✓</span>
          <span style="color: #374151;">${feature}</span>
        </li>
        `,
          )
          .join('')}
      </ul>
    </div>
    `
        : ''
    }

    <div class="card" style="text-align: center; background-color: #f0fdf4;">
      <p style="font-size: 14px; color: #374151; margin-bottom: 8px;">
        Continue with ${data.planName} for just
      </p>
      <p style="font-size: 28px; font-weight: 700; color: #059669; margin: 0;">
        ${formatCurrency(data.priceMonthly, currency)}/month
      </p>
    </div>

    <div class="section text-center mt-4">
      <a href="${data.upgradeUrl}" class="btn btn-success">
        Upgrade Now
      </a>
      <p class="text-muted mt-4" style="font-size: 13px;">
        No commitment - cancel anytime
      </p>
    </div>
  `;

  const html = baseTemplate(
    content,
    {
      preheader: `Your ${data.planName} trial ends ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`} - upgrade now!`,
    },
    config,
  );

  const text = `
Your Trial Ends ${daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} Days`}

Hi ${data.userName}, don't lose access to ${data.planName}!

Trial Ends On: ${formatDate(data.trialEndDate)}

${
  data.features && data.features.length > 0
    ? `
Keep These Features:
${data.features
  .slice(0, 5)
  .map((f) => `- ${f}`)
  .join('\n')}
`
    : ''
}

Continue with ${data.planName} for just ${formatCurrency(data.priceMonthly, currency)}/month

Upgrade now: ${data.upgradeUrl}

No commitment - cancel anytime
  `.trim();

  return {
    html,
    text,
    subject: `Your trial ends ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`} - Upgrade to ${data.planName}`,
  };
}
