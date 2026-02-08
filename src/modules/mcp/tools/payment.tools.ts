import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpContext } from '../interfaces';

export function registerPaymentTools(server: McpServer, ctx: McpContext) {
  if (!ctx.hasScope('payments')) return;

  if (ctx.hasPermission('billing:read_invoice')) {
    server.tool(
      'list-payments',
      'List payments with optional filters (method, status, date range)',
      {
        method: z.string().optional().describe('Filter by method: cash, card, upi, etc.'),
        status: z.string().optional().describe('Filter by status: pending, completed, refunded'),
        fromDate: z.string().optional().describe('Start date (ISO 8601)'),
        toDate: z.string().optional().describe('End date (ISO 8601)'),
        limit: z.number().min(1).max(100).default(20).describe('Number of results'),
        offset: z.number().min(0).default(0).describe('Pagination offset'),
      },
      async (params) => {
        const result = await ctx.paymentService.getPayments(ctx.businessId, {
          method: params.method as any,
          status: params.status,
          fromDate: params.fromDate ? new Date(params.fromDate) : undefined,
          toDate: params.toDate ? new Date(params.toDate) : undefined,
          limit: params.limit,
          offset: params.offset,
        });
        await ctx.audit('payment.list', 'payment', null, { filters: params });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-payment',
      'Get details of a specific payment',
      { paymentId: z.string().describe('The payment UUID') },
      async ({ paymentId }) => {
        const result = await ctx.paymentService.getPaymentById(ctx.businessId, paymentId);
        await ctx.audit('payment.read', 'payment', paymentId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-payment-summary',
      'Get payment summary/statistics for a date (defaults to today)',
      { date: z.string().optional().describe('Date (ISO 8601), defaults to today') },
      async ({ date }) => {
        const result = await ctx.paymentService.getPaymentSummary(
          ctx.businessId,
          date ? new Date(date) : undefined,
        );
        await ctx.audit('payment.summary', 'payment', null, { date });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-payments-by-order',
      'Get all payments associated with a specific order',
      { orderId: z.string().describe('The order UUID') },
      async ({ orderId }) => {
        const result = await ctx.paymentService.getPaymentsByOrder(ctx.businessId, orderId);
        await ctx.audit('payment.read_by_order', 'payment', null, { orderId });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }

  if (ctx.hasPermission('billing:process_payment')) {
    server.tool(
      'create-payment',
      'Record a payment against an order',
      {
        orderId: z.string().describe('The order UUID'),
        amount: z.number().min(0.01).max(999999.99).describe('Payment amount'),
        method: z.enum(['cash', 'card', 'upi', 'net_banking', 'wallet', 'bank_transfer', 'other']).describe('Payment method'),
        transactionRef: z.string().optional().describe('Transaction reference (required for card/UPI)'),
      },
      async ({ orderId, amount, method, transactionRef }) => {
        const result = await ctx.paymentService.createPayment(
          ctx.businessId,
          ctx.userId,
          { orderId, amount, method, transactionRef } as any,
        );
        await ctx.audit('payment.create', 'payment', result.payment.id, {
          orderId,
          amount,
          method,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
}
