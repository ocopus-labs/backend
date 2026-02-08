import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpContext } from '../interfaces';

export function registerSearchTools(server: McpServer, ctx: McpContext) {
  if (!ctx.hasScope('search')) return;

  if (ctx.hasPermission('operations:read')) {
    server.tool(
      'global-search',
      'Search across orders, menu items, team, tables, expenses, and inventory',
      {
        query: z.string().min(2).describe('Search query (min 2 characters)'),
        types: z.array(z.string()).optional().describe('Resource types to search: orders, menu, team, tables, expenses, inventory'),
        limit: z.number().min(1).max(10).default(5).describe('Results per type'),
      },
      async ({ query, types, limit }) => {
        const result = await ctx.searchService.globalSearch(
          ctx.businessId,
          query,
          types,
          limit,
        );
        await ctx.audit('search.global', 'search', null, { query, types });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
}
