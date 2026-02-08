import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpContext } from '../interfaces';
import { registerOrderTools } from './order.tools';
import { registerMenuTools } from './menu.tools';
import { registerTableTools } from './table.tools';
import { registerInventoryTools } from './inventory.tools';
import { registerPaymentTools } from './payment.tools';
import { registerAnalyticsTools } from './analytics.tools';
import { registerTeamTools } from './team.tools';
import { registerExpenseTools } from './expense.tools';
import { registerSearchTools } from './search.tools';

export function registerAllTools(server: McpServer, ctx: McpContext): void {
  registerOrderTools(server, ctx);
  registerMenuTools(server, ctx);
  registerTableTools(server, ctx);
  registerInventoryTools(server, ctx);
  registerPaymentTools(server, ctx);
  registerAnalyticsTools(server, ctx);
  registerTeamTools(server, ctx);
  registerExpenseTools(server, ctx);
  registerSearchTools(server, ctx);
}
