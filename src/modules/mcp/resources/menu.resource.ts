import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpContext } from '../interfaces';

export function registerMenuResource(server: McpServer, ctx: McpContext) {
  server.resource(
    'full-menu',
    'business://menu',
    { description: 'Complete menu with all categories, items, prices, and availability' },
    async () => {
      const menu = await ctx.menuService.getMenu(ctx.businessId);
      return {
        contents: [
          {
            uri: 'business://menu',
            mimeType: 'application/json',
            text: JSON.stringify(menu, null, 2),
          },
        ],
      };
    },
  );
}
