/**
 * Invoice Email Templates
 */

import {
  baseTemplate,
  generatePlainText,
  TemplateConfig,
} from './base.template';

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessGstin?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount?: number;
  taxRate?: number;
  discountAmount?: number;
  discountLabel?: string;
  totalAmount: number;
  paidAmount?: number;
  balanceDue?: number;
  paymentMethod?: string;
  notes?: string;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
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
 * Generate invoice email HTML
 */
export function invoiceEmailTemplate(
  data: InvoiceData,
  config?: Partial<TemplateConfig>,
): { html: string; text: string; subject: string } {
  const currency = data.currency || 'INR';
  const isPaid = data.paidAmount && data.paidAmount >= data.totalAmount;

  const content = `
    <div class="section">
      <h2 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 8px;">
        Invoice ${data.invoiceNumber}
      </h2>
      <p class="text-muted">
        ${isPaid
          ? '<span class="badge badge-success">PAID</span>'
          : data.balanceDue && data.balanceDue > 0
            ? '<span class="badge badge-warning">PENDING</span>'
            : ''}
      </p>
    </div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
        <div>
          <p class="text-muted text-small" style="margin-bottom: 4px;">FROM</p>
          <p style="font-weight: 600; color: #111827; margin-bottom: 4px;">${data.businessName}</p>
          ${data.businessAddress ? `<p class="text-muted text-small">${data.businessAddress}</p>` : ''}
          ${data.businessPhone ? `<p class="text-muted text-small">${data.businessPhone}</p>` : ''}
          ${data.businessGstin ? `<p class="text-muted text-small">GSTIN: ${data.businessGstin}</p>` : ''}
        </div>
        <div>
          <p class="text-muted text-small" style="margin-bottom: 4px;">TO</p>
          <p style="font-weight: 600; color: #111827; margin-bottom: 4px;">${data.customerName}</p>
          ${data.customerEmail ? `<p class="text-muted text-small">${data.customerEmail}</p>` : ''}
          ${data.customerAddress ? `<p class="text-muted text-small">${data.customerAddress}</p>` : ''}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="info-row">
        <span class="info-label">Invoice Number</span>
        <span class="info-value">${data.invoiceNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Invoice Date</span>
        <span class="info-value">${formatDate(data.invoiceDate)}</span>
      </div>
      ${data.dueDate ? `
      <div class="info-row">
        <span class="info-label">Due Date</span>
        <span class="info-value">${formatDate(data.dueDate)}</span>
      </div>
      ` : ''}
      ${data.paymentMethod ? `
      <div class="info-row">
        <span class="info-label">Payment Method</span>
        <span class="info-value">${data.paymentMethod}</span>
      </div>
      ` : ''}
    </div>

    <div class="section">
      <h3 class="section-title">Items</h3>
      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
          <tr>
            <td>${item.name}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">${formatCurrency(item.unitPrice, currency)}</td>
            <td style="text-align: right;">${formatCurrency(item.total, currency)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card" style="background-color: #f9fafb;">
      <div class="info-row">
        <span class="info-label">Subtotal</span>
        <span class="info-value">${formatCurrency(data.subtotal, currency)}</span>
      </div>
      ${data.taxAmount && data.taxRate ? `
      <div class="info-row">
        <span class="info-label">Tax (${data.taxRate}%)</span>
        <span class="info-value">${formatCurrency(data.taxAmount, currency)}</span>
      </div>
      ` : ''}
      ${data.discountAmount ? `
      <div class="info-row">
        <span class="info-label">${data.discountLabel || 'Discount'}</span>
        <span class="info-value" style="color: #059669;">-${formatCurrency(data.discountAmount, currency)}</span>
      </div>
      ` : ''}
      <div class="divider"></div>
      <div class="info-row" style="padding-bottom: 0;">
        <span style="font-size: 16px; font-weight: 600; color: #111827;">Total Amount</span>
        <span style="font-size: 18px; font-weight: 700; color: #111827;">${formatCurrency(data.totalAmount, currency)}</span>
      </div>
      ${data.paidAmount !== undefined ? `
      <div class="info-row">
        <span class="info-label">Amount Paid</span>
        <span class="info-value" style="color: #059669;">${formatCurrency(data.paidAmount, currency)}</span>
      </div>
      ` : ''}
      ${data.balanceDue !== undefined && data.balanceDue > 0 ? `
      <div class="info-row" style="padding-bottom: 0;">
        <span style="font-weight: 600; color: #dc2626;">Balance Due</span>
        <span style="font-weight: 600; color: #dc2626;">${formatCurrency(data.balanceDue, currency)}</span>
      </div>
      ` : ''}
    </div>

    ${data.notes ? `
    <div class="card card-accent">
      <p class="text-muted text-small" style="margin-bottom: 4px;">Notes</p>
      <p style="color: #374151; font-size: 14px;">${data.notes}</p>
    </div>
    ` : ''}

    <div class="section text-center mt-4">
      <p class="text-muted" style="margin-bottom: 16px;">
        Thank you for your business! If you have any questions about this invoice, please contact us.
      </p>
    </div>
  `;

  const html = baseTemplate(content, {
    preheader: `Invoice ${data.invoiceNumber} from ${data.businessName}`,
  }, config);

  const text = `
Invoice ${data.invoiceNumber}
${isPaid ? '(PAID)' : data.balanceDue ? '(PENDING)' : ''}

From: ${data.businessName}
${data.businessAddress || ''}
${data.businessPhone || ''}
${data.businessGstin ? `GSTIN: ${data.businessGstin}` : ''}

To: ${data.customerName}
${data.customerEmail || ''}
${data.customerAddress || ''}

Invoice Date: ${formatDate(data.invoiceDate)}
${data.dueDate ? `Due Date: ${formatDate(data.dueDate)}` : ''}
${data.paymentMethod ? `Payment Method: ${data.paymentMethod}` : ''}

Items:
${data.items.map(item => `- ${item.name} x${item.quantity} @ ${formatCurrency(item.unitPrice, currency)} = ${formatCurrency(item.total, currency)}`).join('\n')}

Subtotal: ${formatCurrency(data.subtotal, currency)}
${data.taxAmount && data.taxRate ? `Tax (${data.taxRate}%): ${formatCurrency(data.taxAmount, currency)}` : ''}
${data.discountAmount ? `Discount: -${formatCurrency(data.discountAmount, currency)}` : ''}
Total: ${formatCurrency(data.totalAmount, currency)}
${data.paidAmount !== undefined ? `Paid: ${formatCurrency(data.paidAmount, currency)}` : ''}
${data.balanceDue !== undefined && data.balanceDue > 0 ? `Balance Due: ${formatCurrency(data.balanceDue, currency)}` : ''}

${data.notes ? `Notes: ${data.notes}` : ''}

Thank you for your business!
  `.trim();

  return {
    html,
    text,
    subject: `Invoice ${data.invoiceNumber} from ${data.businessName}`,
  };
}

/**
 * Generate payment receipt email
 */
export interface PaymentReceiptData {
  receiptNumber: string;
  paymentDate: Date;
  customerName: string;
  businessName: string;
  amount: number;
  paymentMethod: string;
  invoiceNumber?: string;
  transactionId?: string;
  currency?: string;
}

export function paymentReceiptTemplate(
  data: PaymentReceiptData,
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
        Payment Received
      </h2>
      <p class="text-muted">Thank you for your payment, ${data.customerName}!</p>
    </div>

    <div class="card" style="text-align: center;">
      <p class="text-muted text-small" style="margin-bottom: 4px;">Amount Paid</p>
      <p style="font-size: 32px; font-weight: 700; color: #059669; margin: 8px 0;">
        ${formatCurrency(data.amount, currency)}
      </p>
      <p class="text-muted text-small">via ${data.paymentMethod}</p>
    </div>

    <div class="card">
      <div class="info-row">
        <span class="info-label">Receipt Number</span>
        <span class="info-value">${data.receiptNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Payment Date</span>
        <span class="info-value">${formatDate(data.paymentDate)}</span>
      </div>
      ${data.invoiceNumber ? `
      <div class="info-row">
        <span class="info-label">Invoice</span>
        <span class="info-value">${data.invoiceNumber}</span>
      </div>
      ` : ''}
      ${data.transactionId ? `
      <div class="info-row">
        <span class="info-label">Transaction ID</span>
        <span class="info-value" style="font-family: monospace; font-size: 13px;">${data.transactionId}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span class="info-label">Business</span>
        <span class="info-value">${data.businessName}</span>
      </div>
    </div>

    <div class="section text-center mt-4">
      <p class="text-muted">
        This receipt confirms that your payment has been successfully processed.
        Please keep this for your records.
      </p>
    </div>
  `;

  const html = baseTemplate(content, {
    preheader: `Payment of ${formatCurrency(data.amount, currency)} received - Receipt ${data.receiptNumber}`,
  }, config);

  const text = `
Payment Received

Thank you for your payment, ${data.customerName}!

Amount Paid: ${formatCurrency(data.amount, currency)}
Payment Method: ${data.paymentMethod}

Receipt Number: ${data.receiptNumber}
Payment Date: ${formatDate(data.paymentDate)}
${data.invoiceNumber ? `Invoice: ${data.invoiceNumber}` : ''}
${data.transactionId ? `Transaction ID: ${data.transactionId}` : ''}
Business: ${data.businessName}

This receipt confirms that your payment has been successfully processed.
Please keep this for your records.
  `.trim();

  return {
    html,
    text,
    subject: `Payment Receipt ${data.receiptNumber} - ${formatCurrency(data.amount, currency)}`,
  };
}
