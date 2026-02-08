import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpContext } from '../interfaces';

export function registerTableLayoutResource(server: McpServer, ctx: McpContext) {
  server.resource(
    'table-layout',
    'business://tables',
    { description: 'Table layout with positions, statuses, capacity, and active sessions' },
    async () => {
      const tables = await ctx.tableService.findAll(ctx.businessId);
      return {
        contents: [
          {
            uri: 'business://tables',
            mimeType: 'application/json',
            text: JSON.stringify(tables, null, 2),
          },
        ],
      };
    },
  );
}
