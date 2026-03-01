import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { Session } from '@thallesp/nestjs-better-auth';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  StockTransactionDto,
} from './dto';
import { BusinessRoles, generateCsv, HttpCacheTTL, Sanitize } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { InventoryStatus } from './interfaces';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business/:businessId/inventory')
@UsePipes(new ValidationPipe({ transform: true }))
@Sanitize()
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private inventoryService: InventoryService) {}

  @Post()
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
  )
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateInventoryItemDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const item = await this.inventoryService.create(
      businessId,
      dto,
      session.user.id,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );

    return {
      message: 'Inventory item created successfully',
      item,
    };
  }

  @Get()
  @HttpCacheTTL(30)
  async findAll(
    @Param('businessId') businessId: string,
    @Query('category') category: string | undefined,
    @Query('status') status: InventoryStatus | undefined,
    @Query('active') active: string | undefined,
    @Query('lowStock') lowStock: string | undefined,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Session() session?: UserSession,
  ) {
    const result = await this.inventoryService.findAll(businessId, {
      category,
      status,
      isActive: active !== undefined ? active === 'true' : undefined,
      lowStock: lowStock === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return result;
  }

  @Get('export')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async exportInventory(
    @Param('businessId') businessId: string,
    @Query('category') category?: string,
    @Query('status') status?: InventoryStatus,
    @Res() res?: Response,
  ) {
    const result = await this.inventoryService.findAll(businessId, {
      category,
      status,
      limit: 10000,
      offset: 0,
    });

    const items = result.items || [];
    const headers = [
      'SKU',
      'Name',
      'Category',
      'Current Stock',
      'Min Stock',
      'Unit',
      'Cost/Unit',
      'Total Value',
      'Status',
    ];
    const rows = items.map((item: any) => [
      item.sku || '',
      item.name || '',
      item.category || '',
      item.currentStock ?? 0,
      item.minimumStock ?? 0,
      item.unit || '',
      item.costPerUnit ?? 0,
      ((item.currentStock ?? 0) * (item.costPerUnit ?? 0)).toFixed(2),
      item.status ||
        (item.currentStock < item.minimumStock ? 'low_stock' : 'in_stock'),
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  @Get('stats')
  @HttpCacheTTL(30)
  async getStats(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const stats = await this.inventoryService.getInventoryStats(businessId);
    return { stats };
  }

  @Get('low-stock')
  @HttpCacheTTL(60)
  async getLowStock(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const items = await this.inventoryService.getLowStockItems(businessId);
    return { items };
  }

  @Get('expiring')
  @HttpCacheTTL(60)
  async getExpiring(
    @Param('businessId') businessId: string,
    @Query('days') days: string | undefined,
    @Session() session: UserSession,
  ) {
    const daysAhead = days ? parseInt(days, 10) : 7;
    const items = await this.inventoryService.getExpiringItems(
      businessId,
      daysAhead,
    );
    return { items };
  }

  @Get(':id')
  async findById(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const item = await this.inventoryService.findByIdOrFail(businessId, id);
    return { item };
  }

  @Get('sku/:sku')
  async findBySku(
    @Param('businessId') businessId: string,
    @Param('sku') sku: string,
    @Session() session: UserSession,
  ) {
    const item = await this.inventoryService.findBySku(businessId, sku);
    if (!item) {
      throw new ForbiddenException('Item not found');
    }

    return { item };
  }

  @Patch(':id')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
  )
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const item = await this.inventoryService.update(
      businessId,
      id,
      dto,
      session.user.id,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );

    return {
      message: 'Inventory item updated successfully',
      item,
    };
  }

  @Get(':id/transactions')
  async getTransactionHistory(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.inventoryService.getTransactionHistory(businessId, id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post(':id/transaction')
  @BusinessRoles(
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async processTransaction(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: StockTransactionDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const item = await this.inventoryService.processStockTransaction(
      businessId,
      id,
      dto,
      session.user.id,
      session.user.name || 'Unknown',
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );

    return {
      message: 'Stock transaction processed successfully',
      item,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async delete(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    await this.inventoryService.delete(businessId, id, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      message: 'Inventory item deleted successfully',
    };
  }
}
