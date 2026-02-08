import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpContext } from '../interfaces';

export function registerAnalyticsTools(server: McpServer, ctx: McpContext) {
  if (!ctx.hasScope('analytics')) return;

  if (ctx.hasPermission('analytics:view')) {
    server.tool(
      'get-dashboard-stats',
      "Get today's dashboard statistics (revenue, orders, AOV, comparisons)",
      {},
      async () => {
        const result = await ctx.analyticsService.getDashboardStats(ctx.businessId);
        await ctx.audit('analytics.dashboard', 'analytics', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-sales-summary',
      'Get sales summary for a date range',
      {
        startDate: z.string().describe('Start date (ISO 8601)'),
        endDate: z.string().describe('End date (ISO 8601)'),
      },
      async ({ startDate, endDate }) => {
        const result = await ctx.analyticsService.getSalesSummary(
          ctx.businessId,
          new Date(startDate),
          new Date(endDate),
        );
        await ctx.audit('analytics.sales_summary', 'analytics', null, { startDate, endDate });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-top-selling-items',
      'Get top selling menu items over a period',
      {
        limit: z.number().min(1).max(50).default(10).describe('Number of items to return'),
        days: z.number().min(1).max(365).default(7).describe('Number of days to look back'),
      },
      async ({ limit, days }) => {
        const result = await ctx.orderService.getTopSellingItems(ctx.businessId, limit, days);
        await ctx.audit('analytics.top_items', 'analytics', null, { limit, days });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-peak-hours',
      'Get peak hours analysis showing order volume and revenue by hour',
      {
        days: z.number().min(1).max(365).default(7).describe('Number of days to analyze'),
      },
      async ({ days }) => {
        const result = await ctx.orderService.getPeakHours(ctx.businessId, days);
        await ctx.audit('analytics.peak_hours', 'analytics', null, { days });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-revenue-trends',
      'Get daily revenue trends over a period',
      {
        days: z.number().min(1).max(365).default(30).describe('Number of days'),
      },
      async ({ days }) => {
        const result = await ctx.orderService.getRevenueTrends(ctx.businessId, days);
        await ctx.audit('analytics.revenue_trends', 'analytics', null, { days });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-payment-breakdown',
      'Get payment method breakdown for a date range',
      {
        startDate: z.string().describe('Start date (ISO 8601)'),
        endDate: z.string().describe('End date (ISO 8601)'),
      },
      async ({ startDate, endDate }) => {
        const result = await ctx.analyticsService.getPaymentMethodBreakdown(
          ctx.businessId,
          new Date(startDate),
          new Date(endDate),
        );
        await ctx.audit('analytics.payment_breakdown', 'analytics', null, { startDate, endDate });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
}
