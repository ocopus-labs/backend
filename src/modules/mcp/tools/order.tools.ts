import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpContext } from '../interfaces';

export function registerOrderTools(server: McpServer, ctx: McpContext) {
  if (!ctx.hasScope('orders')) return;

  if (ctx.hasPermission('operations:read')) {
    server.tool(
      'list-orders',
      'List orders with optional filters (status, date range, pagination)',
      {
        status: z.string().optional().describe('Filter by status: active, completed, cancelled'),
        paymentStatus: z.string().optional().describe('Filter by payment: pending, partial, paid'),
        orderType: z.string().optional().describe('Filter by type: dine_in, takeaway, delivery'),
        fromDate: z.string().optional().describe('Start date (ISO 8601)'),
        toDate: z.string().optional().describe('End date (ISO 8601)'),
        limit: z.number().min(1).max(100).default(20).describe('Number of results'),
        offset: z.number().min(0).default(0).describe('Pagination offset'),
      },
      async (params) => {
        const result = await ctx.orderService.getOrders(ctx.businessId, {
          status: params.status,
          paymentStatus: params.paymentStatus,
          orderType: params.orderType,
          fromDate: params.fromDate ? new Date(params.fromDate) : undefined,
          toDate: params.toDate ? new Date(params.toDate) : undefined,
          limit: params.limit,
          offset: params.offset,
        });
        await ctx.audit('order.list', 'order', null, { filters: params });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-order',
      'Get a specific order by its ID',
      { orderId: z.string().describe('The order UUID') },
      async ({ orderId }) => {
        const result = await ctx.orderService.getOrderById(ctx.businessId, orderId);
        await ctx.audit('order.read', 'order', orderId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-order-by-number',
      'Get an order by its human-readable order number (e.g. ORD-001)',
      { orderNumber: z.string().describe('The order number') },
      async ({ orderNumber }) => {
        const result = await ctx.orderService.getOrderByNumber(ctx.businessId, orderNumber);
        await ctx.audit('order.read', 'order', null, { orderNumber });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-active-orders',
      'Get all currently active orders',
      {},
      async () => {
        const result = await ctx.orderService.getActiveOrders(ctx.businessId);
        await ctx.audit('order.list_active', 'order', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-order-stats',
      'Get order statistics for a given date (defaults to today)',
      { date: z.string().optional().describe('Date (ISO 8601), defaults to today') },
      async ({ date }) => {
        const result = await ctx.orderService.getOrderStats(
          ctx.businessId,
          date ? new Date(date) : undefined,
        );
        await ctx.audit('order.stats', 'order', null, { date });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }

  if (ctx.hasPermission('operations:create')) {
    server.tool(
      'create-order',
      'Create a new order with items',
      {
        orderType: z.enum(['dine_in', 'takeaway', 'delivery']).describe('Type of order'),
        tableId: z.string().optional().describe('Table ID for dine-in orders'),
        customerName: z.string().optional().describe('Customer name'),
        customerPhone: z.string().optional().describe('Customer phone'),
        items: z.array(z.object({
          id: z.string().describe('Menu item ID'),
          name: z.string().describe('Item name'),
          price: z.number().describe('Item price'),
          quantity: z.number().min(1).describe('Quantity'),
          category: z.string().optional().describe('Category name'),
          modifiers: z.array(z.object({
            name: z.string(),
            price: z.number(),
          })).optional().describe('Selected modifiers'),
          notes: z.string().optional().describe('Special instructions'),
        })).min(1).describe('Order items'),
        notes: z.string().optional().describe('Order-level notes'),
      },
      async (params) => {
        const result = await ctx.orderService.createOrder(
          ctx.businessId,
          ctx.userId,
          ctx.userName,
          {
            orderType: params.orderType,
            tableId: params.tableId,
            customerName: params.customerName || '',
            customerPhone: params.customerPhone || '',
            items: params.items,
            notes: params.notes,
          } as any,
        );
        await ctx.audit('order.create', 'order', result.order.id, {
          orderNumber: result.order.orderNumber,
          itemCount: params.items.length,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }

  if (ctx.hasPermission('operations:update')) {
    server.tool(
      'update-order-status',
      'Update the status of an order (e.g. complete or cancel)',
      {
        orderId: z.string().describe('The order UUID'),
        status: z.enum(['active', 'completed', 'cancelled']).describe('New status'),
      },
      async ({ orderId, status }) => {
        const result = await ctx.orderService.updateOrderStatus(
          ctx.businessId,
          orderId,
          ctx.userId,
          { status } as any,
        );
        await ctx.audit('order.update_status', 'order', orderId, { status });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'add-order-items',
      'Add items to an existing order',
      {
        orderId: z.string().describe('The order UUID'),
        items: z.array(z.object({
          id: z.string().describe('Menu item ID'),
          name: z.string().describe('Item name'),
          price: z.number().describe('Item price'),
          quantity: z.number().min(1).describe('Quantity'),
          category: z.string().optional(),
          modifiers: z.array(z.object({
            name: z.string(),
            price: z.number(),
          })).optional(),
          notes: z.string().optional(),
        })).min(1).describe('Items to add'),
      },
      async ({ orderId, items }) => {
        const result = await ctx.orderService.addItemsToOrder(
          ctx.businessId,
          orderId,
          ctx.userId,
          { items } as any,
        );
        await ctx.audit('order.add_items', 'order', orderId, { itemCount: items.length });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
}
