export type PaymentMethod = 'cash' | 'card' | 'upi' | 'net_banking' | 'wallet' | 'other';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';

export interface CustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
}

export interface BillingAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface TaxDetails {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface RefundEntry {
  id: string;
  amount: number;
  reason?: string;
  refundedBy: string;
  refundedAt: string;
  method: PaymentMethod;
}

export interface Receipt {
  receiptNumber: string;
  generatedAt: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change?: number;
}

export interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  byMethod: Record<PaymentMethod, { count: number; amount: number }>;
  pendingAmount: number;
  refundedAmount: number;
}
