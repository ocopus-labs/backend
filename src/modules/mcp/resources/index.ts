import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpContext } from '../interfaces';
import { registerBusinessResource } from './business.resource';
import { registerMenuResource } from './menu.resource';
import { registerTableLayoutResource } from './table-layout.resource';

export function registerAllResources(server: McpServer, ctx: McpContext): void {
  registerBusinessResource(server, ctx);
  registerMenuResource(server, ctx);
  registerTableLayoutResource(server, ctx);
}
