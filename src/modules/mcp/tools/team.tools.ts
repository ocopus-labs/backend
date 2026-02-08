import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { McpContext } from '../interfaces';

export function registerTeamTools(server: McpServer, ctx: McpContext) {
  if (!ctx.hasScope('team')) return;

  if (ctx.hasPermission('business:read')) {
    server.tool(
      'list-team-members',
      'List all team members with their roles and status',
      {
        limit: z.number().min(1).max(100).default(50).describe('Number of results'),
        offset: z.number().min(0).default(0).describe('Pagination offset'),
      },
      async ({ limit, offset }) => {
        const result = await ctx.teamService.findAll(ctx.businessId, limit, offset);
        await ctx.audit('team.list', 'team', null);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'get-team-member',
      'Get details of a specific team member',
      { memberId: z.string().describe('The team member (BusinessUser) UUID') },
      async ({ memberId }) => {
        const result = await ctx.teamService.findByIdOrFail(ctx.businessId, memberId);
        await ctx.audit('team.read', 'team', memberId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
}
