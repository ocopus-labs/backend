import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpContext } from '../interfaces';

export function registerTableTools(server: McpServer, ctx: McpContext) {
  if (!ctx.hasScope('tables')) return;

  if (ctx.hasPermission('scheduling:read')) {
    server.tool(
      'list-tables',
      'List all tables with their current status, capacity, and session info',
      {},
      async () => {
        const result = await ctx.tableService.findAll(ctx.businessId);
        await ctx.audit('table.list', 'table', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-table',
      'Get details of a specific table including current session',
      { tableId: z.string().describe('The table UUID') },
      async ({ tableId }) => {
        const result = await ctx.tableService.findByIdOrFail(ctx.businessId, tableId);
        await ctx.audit('table.read', 'table', tableId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-table-stats',
      'Get table occupancy statistics (total, available, occupied, reserved)',
      {},
      async () => {
        const result = await ctx.tableService.getTableStats(ctx.businessId);
        await ctx.audit('table.stats', 'table', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
}
