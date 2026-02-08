import {
  Injectable,
  Logger,
  OnModuleDestroy,
  BadRequestException,
} from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';

import { PrismaService } from 'src/modules/prisma/prisma.service';
import { OrderService } from 'src/modules/order';
import { MenuService } from 'src/modules/menu';
import { TableService } from 'src/modules/table';
import { InventoryService } from 'src/modules/inventory';
import { PaymentService } from 'src/modules/payment';
import { AnalyticsService } from 'src/modules/analytics';
import { TeamService } from 'src/modules/team';
import { ExpenseService } from 'src/modules/expense';
import { SearchService } from 'src/modules/search';
import { BusinessService } from 'src/modules/business';
import { ApiKeyService } from './api-key.service';
import { McpContext } from './interfaces';
import { registerAllTools } from './tools';
import { registerAllResources } from './resources';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  lastActivity: number;
  apiKeyId: string;
}

@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private readonly sessions = new Map<string, SessionEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  // Per-key rate limiting: Map<apiKeyId, { count, windowStart }>
  private readonly rateLimits = new Map<
    string,
    { count: number; windowStart: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyService: ApiKeyService,
    private readonly orderService: OrderService,
    private readonly menuService: MenuService,
    private readonly tableService: TableService,
    private readonly inventoryService: InventoryService,
    private readonly paymentService: PaymentService,
    private readonly analyticsService: AnalyticsService,
    private readonly teamService: TeamService,
    private readonly expenseService: ExpenseService,
    private readonly searchService: SearchService,
    private readonly businessService: BusinessService,
  ) {
    this.cleanupInterval = setInterval(
      () => this.cleanupSessions(),
      5 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
    for (const [, entry] of this.sessions) {
      entry.server.close().catch(() => {});
    }
    this.sessions.clear();
  }

  checkRateLimit(apiKeyId: string, limit: number): void {
    const now = Date.now();
    const windowMs = 60_000; // 1 minute window
    let entry = this.rateLimits.get(apiKeyId);

    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now };
      this.rateLimits.set(apiKeyId, entry);
    }

    entry.count++;
    if (entry.count > limit) {
      throw new BadRequestException('Rate limit exceeded');
    }
  }

  async handleRequest(
    req: any,
    res: any,
    body: any,
    apiKeyContext: {
      id: string;
      name: string;
      userId: string;
      restaurantId: string;
      scopes: string[];
      permissions: string[];
      rateLimit: number;
      userName: string;
    },
  ): Promise<void> {
    this.checkRateLimit(apiKeyContext.id, apiKeyContext.rateLimit);

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // Try to reuse existing session
    if (sessionId) {
      const entry = this.sessions.get(sessionId);
      if (entry) {
        // Verify the session belongs to the same API key
        if (entry.apiKeyId !== apiKeyContext.id) {
          res
            .status(403)
            .json({ error: 'Session does not belong to this API key' });
          return;
        }
        entry.lastActivity = Date.now();
        await entry.transport.handleRequest(req, res, body);
        return;
      }
    }

    // Initialize new session
    if (isInitializeRequest(body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          this.sessions.set(sid, {
            transport,
            server,
            lastActivity: Date.now(),
            apiKeyId: apiKeyContext.id,
          });
          this.logger.log(
            `MCP session created: ${sid} for key "${apiKeyContext.name}" (business: ${apiKeyContext.restaurantId})`,
          );
        },
      });

      const server = this.createServer(apiKeyContext);
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
      return;
    }

    // No session and not an initialize request
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message:
          'Bad Request: No valid session. Send an initialize request first.',
      },
      id: null,
    });
  }

  async handleGetRequest(req: any, res: any): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !this.sessions.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session' });
      return;
    }
    const entry = this.sessions.get(sessionId);
    entry.lastActivity = Date.now();
    await entry.transport.handleRequest(req, res);
  }

  async handleDeleteRequest(req: any, res: any): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && this.sessions.has(sessionId)) {
      const entry = this.sessions.get(sessionId);
      await entry.server.close();
      this.sessions.delete(sessionId);
      this.logger.log(`MCP session closed: ${sessionId}`);
    }
    res.status(200).json({ message: 'Session closed' });
  }

  private createServer(apiKeyContext: {
    id: string;
    name: string;
    userId: string;
    restaurantId: string;
    scopes: string[];
    permissions: string[];
    userName: string;
  }): McpServer {
    const server = new McpServer(
      {
        name: 'POS Platform MCP Server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    const ctx = this.buildContext(apiKeyContext);
    registerAllTools(server, ctx);
    registerAllResources(server, ctx);

    return server;
  }

  private buildContext(apiKeyContext: {
    id: string;
    name: string;
    userId: string;
    restaurantId: string;
    scopes: string[];
    permissions: string[];
    userName: string;
  }): McpContext {
    const self = this;
    return {
      businessId: apiKeyContext.restaurantId,
      userId: apiKeyContext.userId,
      userName: apiKeyContext.userName,
      apiKeyId: apiKeyContext.id,
      apiKeyName: apiKeyContext.name,
      scopes: apiKeyContext.scopes,
      permissions: apiKeyContext.permissions,

      hasScope(scope: string): boolean {
        return this.scopes.includes(scope);
      },
      hasPermission(perm: string): boolean {
        return this.permissions.includes(perm);
      },
      async audit(
        action: string,
        resource: string,
        resourceId: string | null,
        details?: Record<string, unknown>,
      ): Promise<void> {
        try {
          await self.prisma.auditLog.create({
            data: {
              restaurantId: apiKeyContext.restaurantId,
              userId: apiKeyContext.userId,
              action,
              resource,
              resourceId,
              details: {
                ...details,
                source: 'mcp',
                apiKeyId: apiKeyContext.id,
                apiKeyName: apiKeyContext.name,
              },
            },
          });
        } catch (err) {
          self.logger.warn(
            `Failed to create audit log: ${(err as Error).message}`,
          );
        }
      },

      // Injected services
      orderService: self.orderService,
      menuService: self.menuService,
      tableService: self.tableService,
      inventoryService: self.inventoryService,
      paymentService: self.paymentService,
      analyticsService: self.analyticsService,
      teamService: self.teamService,
      expenseService: self.expenseService,
      searchService: self.searchService,
      businessService: self.businessService,
      prisma: self.prisma,
    };
  }

  private cleanupSessions(): void {
    const now = Date.now();
    for (const [sessionId, entry] of this.sessions) {
      if (now - entry.lastActivity > SESSION_TIMEOUT_MS) {
        entry.server.close().catch(() => {});
        this.sessions.delete(sessionId);
        this.logger.log(`MCP session expired: ${sessionId}`);
      }
    }
  }
}
