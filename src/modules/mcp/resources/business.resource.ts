import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpContext } from '../interfaces';

export function registerBusinessResource(server: McpServer, ctx: McpContext) {
  server.resource(
    'business-info',
    'business://info',
    {
      description:
        'Business details including name, type, settings, currency, and contact info',
    },
    async () => {
      const business = await ctx.businessService.findByIdOrFail(ctx.businessId);
      return {
        contents: [
          {
            uri: 'business://info',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                id: business.id,
                name: business.name,
                slug: business.slug,
                type: business.type,
                description: business.description,
                address: business.address,
                contact: business.contact,
                settings: business.settings,
                status: business.status,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
