import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpContext } from '../interfaces';

export function registerExpenseTools(server: McpServer, ctx: McpContext) {
  if (!ctx.hasScope('expenses')) return;

  if (ctx.hasPermission('expense:read')) {
    server.tool(
      'list-expenses',
      'List expenses with optional filters (category, status, date range)',
      {
        categoryId: z.string().optional().describe('Filter by category ID'),
        status: z.string().optional().describe('Filter by status: pending, approved, rejected, paid'),
        startDate: z.string().optional().describe('Start date (ISO 8601)'),
        endDate: z.string().optional().describe('End date (ISO 8601)'),
        limit: z.number().min(1).max(100).default(20).describe('Number of results'),
        offset: z.number().min(0).default(0).describe('Pagination offset'),
      },
      async (params) => {
        const result = await ctx.expenseService.findAll(ctx.businessId, {
          categoryId: params.categoryId,
          status: params.status as any,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          limit: params.limit,
          offset: params.offset,
        });
        await ctx.audit('expense.list', 'expense', null, { filters: params });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-expense-summary',
      'Get expense summary/statistics for a date range',
      {
        startDate: z.string().optional().describe('Start date (ISO 8601)'),
        endDate: z.string().optional().describe('End date (ISO 8601)'),
      },
      async ({ startDate, endDate }) => {
        const result = await ctx.expenseService.getSummary(
          ctx.businessId,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined,
        );
        await ctx.audit('expense.summary', 'expense', null, { startDate, endDate });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'list-expense-categories',
      'List all expense categories',
      {},
      async () => {
        const result = await ctx.expenseService.findAllCategories(ctx.businessId);
        await ctx.audit('expense.list_categories', 'expense', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }

  if (ctx.hasPermission('expense:create')) {
    server.tool(
      'create-expense',
      'Record a new expense',
      {
        title: z.string().max(200).describe('Expense title'),
        categoryId: z.string().describe('Expense category ID'),
        amount: z.number().min(0.01).max(999999.99).describe('Amount'),
        expenseDate: z.string().describe('Date of expense (ISO 8601)'),
        paymentMethod: z.enum(['cash', 'card', 'upi', 'bank_transfer', 'other']).describe('Payment method'),
        description: z.string().optional().describe('Description'),
        vendorName: z.string().optional().describe('Vendor name'),
        receiptNumber: z.string().optional().describe('Receipt number'),
      },
      async (params) => {
        const result = await ctx.expenseService.create(
          ctx.businessId,
          {
            title: params.title,
            categoryId: params.categoryId,
            amount: params.amount,
            expenseDate: params.expenseDate,
            paymentMethod: params.paymentMethod,
            description: params.description,
            vendorName: params.vendorName,
            receiptNumber: params.receiptNumber,
          } as any,
          ctx.userId,
        );
        await ctx.audit('expense.create', 'expense', result.id, {
          title: params.title,
          amount: params.amount,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
}
