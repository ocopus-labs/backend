/**
 * Professional Email Template System
 *
 * This module provides clean, professional email templates
 * with consistent branding and responsive design.
 */

export interface TemplateConfig {
  appName: string;
  appUrl: string;
  supportEmail: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface BaseTemplateOptions {
  preheader?: string;
  footerText?: string;
}

const defaultConfig: TemplateConfig = {
  appName: 'POS Platform',
  appUrl: 'https://pos.example.com',
  supportEmail: 'support@example.com',
  primaryColor: '#1a1a2e',
  accentColor: '#4f46e5',
};

/**
 * Base email template with consistent header and footer
 */
export function baseTemplate(
  content: string,
  options: BaseTemplateOptions = {},
  config: Partial<TemplateConfig> = {},
): string {
  const cfg = { ...defaultConfig, ...config };
  const preheader = options.preheader || '';
  const currentYear = new Date().getFullYear();
  const footerText =
    options.footerText ||
    `© ${currentYear} ${cfg.appName}. All rights reserved.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${cfg.appName}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #374151;
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
    }
    .preheader {
      display: none !important;
      visibility: hidden;
      mso-hide: all;
      font-size: 1px;
      line-height: 1px;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }
    .email-wrapper {
      width: 100%;
      background-color: #f3f4f6;
      padding: 40px 16px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background-color: ${cfg.primaryColor};
      padding: 32px 40px;
      text-align: center;
    }
    .email-header h1 {
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .email-body {
      padding: 40px;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .email-footer p {
      color: #6b7280;
      font-size: 13px;
      margin: 4px 0;
    }
    .email-footer a {
      color: #6b7280;
      text-decoration: underline;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background-color: ${cfg.accentColor};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      text-align: center;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: #4338ca;
    }
    .btn-secondary {
      background-color: #6b7280;
    }
    .btn-success {
      background-color: #059669;
    }
    .section {
      margin-bottom: 24px;
    }
    .section:last-child {
      margin-bottom: 0;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 12px;
    }
    .card {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 16px 0;
    }
    .card-accent {
      border-left: 4px solid ${cfg.accentColor};
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #6b7280;
      font-size: 14px;
    }
    .info-value {
      color: #111827;
      font-weight: 500;
      font-size: 14px;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 24px 0;
    }
    .text-center {
      text-align: center;
    }
    .text-muted {
      color: #6b7280;
      font-size: 14px;
    }
    .text-small {
      font-size: 13px;
    }
    .mt-4 {
      margin-top: 16px;
    }
    .mb-4 {
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-success {
      background-color: #d1fae5;
      color: #065f46;
    }
    .badge-warning {
      background-color: #fef3c7;
      color: #92400e;
    }
    .badge-error {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .badge-info {
      background-color: #dbeafe;
      color: #1e40af;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #f9fafb;
      font-weight: 600;
      font-size: 13px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      font-size: 14px;
      color: #374151;
    }
    .amount {
      font-weight: 600;
      color: #111827;
    }
    .total-row {
      background-color: #f9fafb;
    }
    .total-row td {
      font-weight: 600;
      color: #111827;
      border-bottom: none;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 16px 8px;
      }
      .email-header {
        padding: 24px 20px;
      }
      .email-body {
        padding: 24px 20px;
      }
      .email-footer {
        padding: 20px;
      }
      .btn {
        display: block;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  ${preheader ? `<div class="preheader">${preheader}</div>` : ''}

  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <h1>${cfg.appName}</h1>
      </div>

      <div class="email-body">
        ${content}
      </div>

      <div class="email-footer">
        <p>${footerText}</p>
        <p>
          <a href="${cfg.appUrl}">Visit our website</a> •
          <a href="mailto:${cfg.supportEmail}">Contact Support</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate a plain text version from HTML content
 */
export function generatePlainText(content: string): string {
  return content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
