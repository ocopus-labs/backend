import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpContext } from '../interfaces';

export function registerInventoryTools(server: McpServer, ctx: McpContext) {
  if (!ctx.hasScope('inventory')) return;

  if (ctx.hasPermission('inventory:read')) {
    server.tool(
      'list-inventory',
      'List inventory items with optional filters (category, status, low stock)',
      {
        category: z.string().optional().describe('Filter by category'),
        status: z.string().optional().describe('Filter by status: in_stock, low_stock, out_of_stock'),
        lowStock: z.boolean().optional().describe('Show only low stock items'),
        limit: z.number().min(1).max(100).default(50).describe('Number of results'),
        offset: z.number().min(0).default(0).describe('Pagination offset'),
      },
      async (params) => {
        const result = await ctx.inventoryService.findAll(ctx.businessId, {
          category: params.category,
          status: params.status as any,
          lowStock: params.lowStock,
          limit: params.limit,
          offset: params.offset,
        });
        await ctx.audit('inventory.list', 'inventory', null, { filters: params });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-inventory-item',
      'Get details of a specific inventory item',
      { itemId: z.string().describe('The inventory item UUID') },
      async ({ itemId }) => {
        const result = await ctx.inventoryService.findByIdOrFail(ctx.businessId, itemId);
        await ctx.audit('inventory.read', 'inventory', itemId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-low-stock-alerts',
      'Get all items that are at or below their minimum stock level',
      {},
      async () => {
        const result = await ctx.inventoryService.getLowStockItems(ctx.businessId);
        await ctx.audit('inventory.low_stock', 'inventory', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-inventory-stats',
      'Get inventory statistics (total items, low stock count, total value, etc.)',
      {},
      async () => {
        const result = await ctx.inventoryService.getInventoryStats(ctx.businessId);
        await ctx.audit('inventory.stats', 'inventory', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }

  if (ctx.hasPermission('inventory:manage_stock')) {
    server.tool(
      'adjust-stock',
      'Adjust stock level for an inventory item (add, remove, waste, adjust)',
      {
        itemId: z.string().describe('The inventory item UUID'),
        type: z.enum(['add', 'remove', 'waste', 'adjust']).describe('Type of adjustment'),
        quantity: z.number().min(0.001).describe('Quantity to adjust'),
        reason: z.string().optional().describe('Reason for adjustment'),
        reference: z.string().optional().describe('Reference number'),
      },
      async ({ itemId, type, quantity, reason, reference }) => {
        const result = await ctx.inventoryService.processStockTransaction(
          ctx.businessId,
          itemId,
          { type, quantity, reason, reference } as any,
          ctx.userId,
          ctx.userName,
        );
        await ctx.audit('inventory.adjust_stock', 'inventory', itemId, {
          type,
          quantity,
          reason,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
}
