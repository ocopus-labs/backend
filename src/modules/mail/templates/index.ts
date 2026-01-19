/**
 * Email Templates Module
 *
 * This module exports all email templates for the application.
 * Templates are designed to be:
 * - Professional and clean
 * - Mobile responsive
 * - Consistent branding
 * - Both HTML and plain text versions
 */

// Base template and utilities
export {
  baseTemplate,
  generatePlainText,
  type TemplateConfig,
  type BaseTemplateOptions,
} from './base.template';

// Invoice and payment templates
export {
  invoiceEmailTemplate,
  paymentReceiptTemplate,
  type InvoiceData,
  type InvoiceItem,
  type PaymentReceiptData,
} from './invoice.template';

// Subscription templates
export {
  subscriptionActivatedTemplate,
  paymentSuccessTemplate,
  paymentFailedTemplate,
  subscriptionCancelledTemplate,
  trialEndingTemplate,
  type SubscriptionPlanInfo,
  type SubscriptionActivatedData,
  type PaymentSuccessData,
  type PaymentFailedData,
  type SubscriptionCancelledData,
  type TrialEndingData,
} from './subscription.template';

// Authentication and transactional templates
export {
  welcomeEmailTemplate,
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  passwordChangedEmailTemplate,
  notificationEmailTemplate,
  type WelcomeEmailData,
  type VerificationEmailData,
  type PasswordResetEmailData,
  type PasswordChangedEmailData,
  type NotificationEmailData,
} from './auth.template';
