import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateInventoryItemDto, UpdateInventoryItemDto, StockTransactionDto } from './dto';
import {
  InventoryItem,
  InventoryStatus,
  INVENTORY_STATUSES,
  InventoryTransaction,
  InventoryAlert,
  TRANSACTION_TYPES,
} from './interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    restaurantId: string,
    dto: CreateInventoryItemDto,
    userId: string,
  ): Promise<InventoryItem> {
    // Check for duplicate SKU
    const existing = await this.prisma.inventoryItem.findUnique({
      where: {
        restaurantId_sku: { restaurantId, sku: dto.sku },
      },
    });

    if (existing) {
      throw new ConflictException(`Item with SKU ${dto.sku} already exists`);
    }

    const totalValue = dto.currentStock * dto.costPerUnit;
    const status = this.calculateStatus(dto.currentStock, dto.minimumStock);

    const item = await this.prisma.inventoryItem.create({
      data: {
        restaurantId,
        name: dto.name,
        sku: dto.sku,
        category: dto.category,
        currentStock: dto.currentStock,
        minimumStock: dto.minimumStock,
        unit: dto.unit,
        costPerUnit: dto.costPerUnit,
        totalValue,
        trackExpiry: dto.trackExpiry || false,
        expiryDate: dto.expiryDate || null,
        status,
        isActive: true,
        transactions: [],
        linkedMenuItems: [],
        alerts: [],
      },
    });

    await this.createAuditLog(restaurantId, userId, 'CREATE', 'inventory', item.id, {
      name: item.name,
      sku: item.sku,
    });

    this.logger.log(`Inventory item ${item.name} created for restaurant ${restaurantId}`);

    return item;
  }

  async findAll(
    restaurantId: string,
    options?: {
      category?: string;
      status?: InventoryStatus;
      isActive?: boolean;
      lowStock?: boolean;
    },
  ): Promise<InventoryItem[]> {
    const where: Record<string, unknown> = { restaurantId };

    if (options?.category) where.category = options.category;
    if (options?.status) where.status = options.status;
    if (options?.isActive !== undefined) where.isActive = options.isActive;
    if (options?.lowStock) {
      where.status = { in: [INVENTORY_STATUSES.LOW_STOCK, INVENTORY_STATUSES.OUT_OF_STOCK] };
    }

    return this.prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findById(restaurantId: string, id: string): Promise<InventoryItem | null> {
    return this.prisma.inventoryItem.findFirst({
      where: { id, restaurantId },
    });
  }

  async findByIdOrFail(restaurantId: string, id: string): Promise<InventoryItem> {
    const item = await this.findById(restaurantId, id);
    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    return item;
  }

  async findBySku(restaurantId: string, sku: string): Promise<InventoryItem | null> {
    return this.prisma.inventoryItem.findUnique({
      where: { restaurantId_sku: { restaurantId, sku } },
    });
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateInventoryItemDto,
    userId: string,
  ): Promise<InventoryItem> {
    const existing = await this.findByIdOrFail(restaurantId, id);

    // Check for duplicate SKU if being changed
    if (dto.sku && dto.sku !== existing.sku) {
      const duplicate = await this.findBySku(restaurantId, dto.sku);
      if (duplicate) {
        throw new ConflictException(`Item with SKU ${dto.sku} already exists`);
      }
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.sku) updateData.sku = dto.sku;
    if (dto.category) updateData.category = dto.category;
    if (dto.minimumStock !== undefined) {
      updateData.minimumStock = dto.minimumStock;
      // Recalculate status
      updateData.status = this.calculateStatus(
        Number(existing.currentStock),
        dto.minimumStock,
      );
    }
    if (dto.unit) updateData.unit = dto.unit;
    if (dto.costPerUnit !== undefined) {
      updateData.costPerUnit = dto.costPerUnit;
      updateData.totalValue = Number(existing.currentStock) * dto.costPerUnit;
    }
    if (dto.trackExpiry !== undefined) updateData.trackExpiry = dto.trackExpiry;
    if (dto.expiryDate !== undefined) updateData.expiryDate = dto.expiryDate;
    if (dto.status) updateData.status = dto.status;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: updateData,
    });

    await this.createAuditLog(restaurantId, userId, 'UPDATE', 'inventory', id, {
      updatedFields: Object.keys(dto),
    });

    return item;
  }

  async processStockTransaction(
    restaurantId: string,
    id: string,
    dto: StockTransactionDto,
    userId: string,
    userName: string,
  ): Promise<InventoryItem> {
    const item = await this.findByIdOrFail(restaurantId, id);

    const previousStock = Number(item.currentStock);
    let newStock: number;

    switch (dto.type) {
      case TRANSACTION_TYPES.ADD:
        newStock = previousStock + dto.quantity;
        break;
      case TRANSACTION_TYPES.REMOVE:
      case TRANSACTION_TYPES.WASTE:
        if (dto.quantity > previousStock) {
          throw new BadRequestException(
            `Insufficient stock. Available: ${previousStock}, Requested: ${dto.quantity}`,
          );
        }
        newStock = previousStock - dto.quantity;
        break;
      case TRANSACTION_TYPES.ADJUST:
        newStock = dto.quantity; // Absolute adjustment
        break;
      default:
        throw new BadRequestException(`Invalid transaction type: ${dto.type}`);
    }

    const transaction: InventoryTransaction = {
      id: uuidv4(),
      type: dto.type,
      quantity: dto.quantity,
      previousStock,
      newStock,
      reason: dto.reason,
      reference: dto.reference,
      performedBy: userName,
      performedAt: new Date().toISOString(),
    };

    const existingTransactions = (item.transactions || []) as object[];
    const status = this.calculateStatus(newStock, Number(item.minimumStock));
    const totalValue = newStock * Number(item.costPerUnit);

    // Check for low stock alert
    const alerts = (item.alerts || []) as object[];
    if (status === INVENTORY_STATUSES.LOW_STOCK && item.status !== INVENTORY_STATUSES.LOW_STOCK) {
      const alert: InventoryAlert = {
        type: 'low_stock',
        message: `${item.name} is running low. Current stock: ${newStock} ${item.unit}`,
        createdAt: new Date().toISOString(),
        acknowledged: false,
      };
      alerts.push(alert);
    } else if (status === INVENTORY_STATUSES.OUT_OF_STOCK) {
      const alert: InventoryAlert = {
        type: 'out_of_stock',
        message: `${item.name} is out of stock`,
        createdAt: new Date().toISOString(),
        acknowledged: false,
      };
      alerts.push(alert);
    }

    const updatedItem = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        currentStock: newStock,
        totalValue,
        status,
        transactions: [...existingTransactions, transaction] as object[],
        alerts: alerts as object[],
      },
    });

    await this.createAuditLog(restaurantId, userId, 'STOCK_TRANSACTION', 'inventory', id, {
      type: dto.type,
      quantity: dto.quantity,
      previousStock,
      newStock,
    });

    this.logger.log(
      `Stock ${dto.type} for ${item.name}: ${previousStock} -> ${newStock}`,
    );

    return updatedItem;
  }

  async getLowStockItems(restaurantId: string): Promise<InventoryItem[]> {
    return this.prisma.inventoryItem.findMany({
      where: {
        restaurantId,
        isActive: true,
        status: { in: [INVENTORY_STATUSES.LOW_STOCK, INVENTORY_STATUSES.OUT_OF_STOCK] },
      },
      orderBy: { currentStock: 'asc' },
    });
  }

  async getExpiringItems(restaurantId: string, daysAhead: number = 7): Promise<InventoryItem[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.prisma.inventoryItem.findMany({
      where: {
        restaurantId,
        isActive: true,
        trackExpiry: true,
        expiryDate: { lte: futureDate },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async getInventoryStats(restaurantId: string): Promise<{
    totalItems: number;
    activeItems: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalValue: number;
    expiringCount: number;
    categoryBreakdown: Record<string, number>;
  }> {
    const items = await this.findAll(restaurantId);
    const expiringItems = await this.getExpiringItems(restaurantId);

    const stats = {
      totalItems: items.length,
      activeItems: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalValue: 0,
      expiringCount: expiringItems.length,
      categoryBreakdown: {} as Record<string, number>,
    };

    for (const item of items) {
      if (item.isActive) stats.activeItems++;
      if (item.status === INVENTORY_STATUSES.LOW_STOCK) stats.lowStockCount++;
      if (item.status === INVENTORY_STATUSES.OUT_OF_STOCK) stats.outOfStockCount++;
      stats.totalValue += Number(item.totalValue);

      if (!stats.categoryBreakdown[item.category]) {
        stats.categoryBreakdown[item.category] = 0;
      }
      stats.categoryBreakdown[item.category]++;
    }

    return stats;
  }

  async delete(restaurantId: string, id: string, userId: string): Promise<void> {
    const item = await this.findByIdOrFail(restaurantId, id);

    // Soft delete - just mark as inactive
    await this.prisma.inventoryItem.update({
      where: { id },
      data: { isActive: false, status: INVENTORY_STATUSES.DISCONTINUED },
    });

    await this.createAuditLog(restaurantId, userId, 'DELETE', 'inventory', id, {
      name: item.name,
      sku: item.sku,
    });

    this.logger.log(`Inventory item ${item.name} deleted from restaurant ${restaurantId}`);
  }

  private calculateStatus(currentStock: number, minimumStock: number): InventoryStatus {
    if (currentStock <= 0) {
      return INVENTORY_STATUSES.OUT_OF_STOCK;
    }
    if (currentStock <= minimumStock) {
      return INVENTORY_STATUSES.LOW_STOCK;
    }
    return INVENTORY_STATUSES.IN_STOCK;
  }

  private async createAuditLog(
    restaurantId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        restaurantId,
        userId,
        action,
        resource,
        resourceId,
        details: details as object,
      },
    });
  }
}
