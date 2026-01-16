import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { InventoryService } from './inventory.service';
import { BusinessService } from 'src/modules/business';
import { CreateInventoryItemDto, UpdateInventoryItemDto, StockTransactionDto } from './dto';
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
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(
    private inventoryService: InventoryService,
    private businessService: BusinessService,
  ) {}

  /**
   * Create a new inventory item
   */
  @Post()
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateInventoryItemDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const item = await this.inventoryService.create(businessId, dto, session.user.id);

    return {
      message: 'Inventory item created successfully',
      item,
    };
  }

  /**
   * List all inventory items
   */
  @Get()
  async findAll(
    @Param('businessId') businessId: string,
    @Query('category') category: string | undefined,
    @Query('status') status: InventoryStatus | undefined,
    @Query('active') active: string | undefined,
    @Query('lowStock') lowStock: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const items = await this.inventoryService.findAll(businessId, {
      category,
      status,
      isActive: active !== undefined ? active === 'true' : undefined,
      lowStock: lowStock === 'true',
    });

    return { items };
  }

  /**
   * Get inventory statistics
   */
  @Get('stats')
  async getStats(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const stats = await this.inventoryService.getInventoryStats(businessId);
    return { stats };
  }

  /**
   * Get low stock items
   */
  @Get('low-stock')
  async getLowStock(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const items = await this.inventoryService.getLowStockItems(businessId);
    return { items };
  }

  /**
   * Get expiring items
   */
  @Get('expiring')
  async getExpiring(
    @Param('businessId') businessId: string,
    @Query('days') days: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const daysAhead = days ? parseInt(days, 10) : 7;
    const items = await this.inventoryService.getExpiringItems(businessId, daysAhead);
    return { items };
  }

  /**
   * Get an inventory item by ID
   */
  @Get(':id')
  async findById(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const item = await this.inventoryService.findByIdOrFail(businessId, id);
    return { item };
  }

  /**
   * Get an inventory item by SKU
   */
  @Get('sku/:sku')
  async findBySku(
    @Param('businessId') businessId: string,
    @Param('sku') sku: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const item = await this.inventoryService.findBySku(businessId, sku);
    if (!item) {
      throw new ForbiddenException('Item not found');
    }

    return { item };
  }

  /**
   * Update an inventory item
   */
  @Patch(':id')
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const item = await this.inventoryService.update(businessId, id, dto, session.user.id);

    return {
      message: 'Inventory item updated successfully',
      item,
    };
  }

  /**
   * Process a stock transaction (add/remove/adjust)
   */
  @Post(':id/transaction')
  async processTransaction(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: StockTransactionDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
      USER_ROLES.STAFF,
    ]);

    const item = await this.inventoryService.processStockTransaction(
      businessId,
      id,
      dto,
      session.user.id,
      session.user.name || 'Unknown',
    );

    return {
      message: 'Stock transaction processed successfully',
      item,
    };
  }

  /**
   * Delete an inventory item (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

    await this.inventoryService.delete(businessId, id, session.user.id);

    return {
      message: 'Inventory item deleted successfully',
    };
  }

  /**
   * Helper to validate business access with optional role check
   */
  private async validateAccess(
    userId: string,
    businessId: string,
    allowedRoles?: string[],
  ): Promise<void> {
    const hasAccess = await this.businessService.checkUserAccess(userId, businessId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    if (allowedRoles) {
      const role = await this.businessService.getUserRole(userId, businessId);
      if (!role || !allowedRoles.includes(role)) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
    }
  }
}
