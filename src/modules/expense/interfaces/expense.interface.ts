import { Expense as PrismaExpense, ExpenseCategory as PrismaExpenseCategory } from '@prisma/client';

export type Expense = PrismaExpense;
export type ExpenseCategory = PrismaExpenseCategory;

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export const EXPENSE_STATUSES: Record<string, ExpenseStatus> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
};

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const RECURRING_FREQUENCIES: Record<string, RecurringFrequency> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

export const PAYMENT_METHODS = [
  'cash',
  'upi',
  'card',
  'bank_transfer',
  'cheque',
  'other',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface ExpenseSummary {
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  categoryBreakdown: Record<string, number>;
  monthlyTrend: { month: string; amount: number }[];
}
