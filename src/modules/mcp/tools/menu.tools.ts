import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpContext } from '../interfaces';

export function registerMenuTools(server: McpServer, ctx: McpContext) {
  if (!ctx.hasScope('menu')) return;

  if (ctx.hasPermission('catalog:read')) {
    server.tool(
      'get-full-menu',
      'Get the complete menu with all categories and items',
      {},
      async () => {
        const result = await ctx.menuService.getMenu(ctx.businessId);
        await ctx.audit('menu.read', 'menu', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'list-menu-items',
      'List menu items with optional category filter and pagination',
      {
        categoryId: z.string().optional().describe('Filter by category ID'),
        limit: z.number().min(1).max(100).default(50).describe('Number of results'),
        offset: z.number().min(0).default(0).describe('Pagination offset'),
      },
      async (params) => {
        const result = await ctx.menuService.getItems(ctx.businessId, params.categoryId, {
          limit: params.limit,
          offset: params.offset,
        });
        await ctx.audit('menu.list_items', 'menu', null, { categoryId: params.categoryId });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-menu-item',
      'Get details of a specific menu item',
      { itemId: z.string().describe('The menu item ID') },
      async ({ itemId }) => {
        const result = await ctx.menuService.getItemById(ctx.businessId, itemId);
        await ctx.audit('menu.read_item', 'menu', itemId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'list-categories',
      'List all menu categories',
      {},
      async () => {
        const result = await ctx.menuService.getCategories(ctx.businessId);
        await ctx.audit('menu.list_categories', 'menu', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }

  if (ctx.hasPermission('catalog:update')) {
    server.tool(
      'toggle-item-availability',
      'Toggle a menu item between available and unavailable',
      { itemId: z.string().describe('The menu item ID') },
      async ({ itemId }) => {
        const result = await ctx.menuService.toggleItemAvailability(
          ctx.businessId,
          itemId,
          ctx.userId,
        );
        await ctx.audit('menu.toggle_availability', 'menu', itemId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'update-item-price',
      'Update the price of a menu item',
      {
        itemId: z.string().describe('The menu item ID'),
        price: z.number().min(0).describe('New price'),
      },
      async ({ itemId, price }) => {
        const result = await ctx.menuService.updateItem(
          ctx.businessId,
          itemId,
          { price } as any,
          ctx.userId,
        );
        await ctx.audit('menu.update_price', 'menu', itemId, { price });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
}
