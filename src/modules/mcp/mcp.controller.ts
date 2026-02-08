import {
  Controller,
  Post,
  Get,
  Delete,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AllowAnonymous } from 'src/lib/common';
import { McpService } from './mcp.service';
import { ApiKeyService } from './api-key.service';

@Controller('mcp')
@AllowAnonymous()
@SkipThrottle()
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpService: McpService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Post()
  async handlePost(@Req() req: any, @Res() res: any) {
    const apiKeyContext = await this.extractAndValidateKey(req, res);
    if (!apiKeyContext) return;

    try {
      await this.mcpService.handleRequest(req, res, req.body, apiKeyContext);
    } catch (err) {
      this.logger.error(`MCP request error: ${(err as Error).message}`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  }

  @Get()
  async handleGet(@Req() req: any, @Res() res: any) {
    const apiKeyContext = await this.extractAndValidateKey(req, res);
    if (!apiKeyContext) return;

    try {
      await this.mcpService.handleGetRequest(req, res);
    } catch (err) {
      this.logger.error(`MCP GET error: ${(err as Error).message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  @Delete()
  async handleDelete(@Req() req: any, @Res() res: any) {
    const apiKeyContext = await this.extractAndValidateKey(req, res);
    if (!apiKeyContext) return;

    try {
      await this.mcpService.handleDeleteRequest(req, res);
    } catch (err) {
      this.logger.error(`MCP DELETE error: ${(err as Error).message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private async extractAndValidateKey(
    req: any,
    res: any,
  ): Promise<{
    id: string;
    name: string;
    userId: string;
    restaurantId: string;
    scopes: string[];
    permissions: string[];
    rateLimit: number;
    userName: string;
  } | null> {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Missing or invalid Authorization header' },
        id: null,
      });
      return null;
    }

    const rawKey = authHeader.slice(7);
    try {
      return await this.apiKeyService.validate(rawKey);
    } catch (err) {
      const message = (err as Error).message || 'Invalid API key';
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message },
        id: null,
      });
      return null;
    }
  }
}
