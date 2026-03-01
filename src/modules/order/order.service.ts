import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  AddItemsToOrderDto,
  UpdateItemQuantityDto,
  ApplyDiscountDto,
} from './dto';
import type {
  OrderItem,
  OrderPricing,
  OrderTimestamps,
  OrderDiscount,
  OrderAuditEntry,
} from './interfaces';
import { OrderGateway } from './order.gateway';
import { UsageTrackingService } from 'src/modules/subscription/usage-tracking.service';
import { TableService } from 'src/modules/table/table.service';
import { LoyaltyService } from 'src/modules/loyalty/loyalty.service';
import { TaxService } from 'src/modules/tax/tax.service';
import { calculateTaxForOrder } from 'src/modules/tax/utils/tax-calculator';
import type { TaxBreakdown } from 'src/modules/tax/interfaces';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { MenuService } from 'src/modules/menu/menu.service';
import type { MenuItemIngredient } from 'src/modules/menu/interfaces';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderGateway: OrderGateway,
    private readonly usageTrackingService: UsageTrackingService,
    private readonly tableService: TableService,
    private readonly loyaltyService: LoyaltyService,
    private readonly taxService: TaxService,
    private readonly inventoryService: InventoryService,
    private readonly menuService: MenuService,
  ) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  private calculateItemTotal(item: CreateOrderDto['items'][0]): number {
    let total = item.basePrice * item.quantity;

    if (item.modifiers) {
      if (item.modifiers.size) {
        total += item.modifiers.size.price * item.quantity;
      }
      if (item.modifiers.spiceLevel) {
        total += item.modifiers.spiceLevel.price * item.quantity;
      }
      if (item.modifiers.addOns) {
        for (const addOn of item.modifiers.addOns) {
          total += addOn.price * item.quantity;
        }
      }
    }

    return total;
  }

  private calculatePricing(
    items: OrderItem[],
    taxRate: number = 0,
    discount?: { type: 'percentage' | 'fixed'; value: number },
    serviceCharge: number = 0,
    taxBreakdown?: TaxBreakdown,
  ): OrderPricing {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

    // Use tax breakdown total if available, otherwise fall back to flat rate
    const taxAmount = taxBreakdown
      ? taxBreakdown.totalTax
      : (subtotal * taxRate) / 100;
    const effectiveRate =
      taxBreakdown && subtotal > 0
        ? Math.round((taxAmount / subtotal) * 10000) / 100
        : taxRate;

    let discountAmount = 0;
    if (discount) {
      discountAmount =
        discount.type === 'percentage'
          ? (subtotal * discount.value) / 100
          : discount.value;
    }

    const total = subtotal + taxAmount - discountAmount + serviceCharge;

    return {
      subtotal,
      taxRate: effectiveRate,
      taxAmount,
      discountType: discount?.type,
      discountValue: discount?.value,
      discountAmount,
      serviceCharge,
      total,
      ...(taxBreakdown && { taxBreakdown }),
    };
  }

  async createOrder(
    businessId: string,
    staffId: string | null,
    staffName: string | null,
    dto: CreateOrderDto,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    // Check subscription order limit
    const limitCheck =
      await this.usageTrackingService.checkOrderLimit(businessId);
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        limitCheck.message ||
          `Monthly order limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your subscription.`,
      );
    }

    const orderNumber = this.generateOrderNumber();
    const now = new Date().toISOString();

    // Transform items with calculated totals
    const orderItems: OrderItem[] = dto.items.map((item) => ({
      id: uuidv4(),
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      basePrice: item.basePrice,
      totalPrice: this.calculateItemTotal(item),
      modifiers: item.modifiers,
      status: 'pending' as const,
    }));

    // Calculate tax breakdown if tax regime is enabled
    let taxBreakdown: TaxBreakdown | undefined;
    try {
      const taxSettings = await this.taxService.getSettings(businessId);
      if (taxSettings.enabled) {
        // Look up menu items to get their tax codes/categories
        const menuData = await this.prisma.menuItem.findFirst({
          where: { restaurantId: businessId },
          select: { categories: true },
        });
        const allMenuItems = menuData
          ? ((menuData.categories as any[]) || []).flatMap(
              (cat: any) => cat.items || [],
            )
          : [];

        const taxableItems = orderItems.map((item) => {
          const menuItem = allMenuItems.find(
            (mi: any) => mi.id === item.menuItemId,
          );
          return {
            id: item.id,
            name: item.name,
            taxCode: menuItem?.taxCode,
            taxCategory: menuItem?.taxCategory,
            customTaxRate: menuItem?.customTaxRate,
            taxableValue: item.totalPrice,
          };
        });

        taxBreakdown = calculateTaxForOrder(taxableItems, taxSettings);
      }
    } catch (err) {
      this.logger.warn(`Tax calculation skipped: ${err}`);
    }

    // Calculate pricing
    const pricing = this.calculatePricing(
      orderItems,
      dto.taxRate,
      dto.discount,
      dto.serviceCharge,
      taxBreakdown,
    );

    // Build timestamps
    const timestamps: OrderTimestamps = {
      placedAt: now,
    };

    // Build discounts array
    const discountsApplied: OrderDiscount[] = [];
    if (dto.discount) {
      discountsApplied.push({
        id: uuidv4(),
        code: dto.discount.code,
        type: dto.discount.type,
        value: dto.discount.value,
        amount: pricing.discountAmount,
        reason: dto.discount.reason,
      });
    }

    // Initial audit trail
    const auditTrail: OrderAuditEntry[] = [
      {
        action: 'order.create',
        performedBy: staffId || 'customer',
        performedAt: now,
        details: { orderType: dto.orderType, itemCount: orderItems.length },
      },
    ];

    // Calculate estimated completion time
    let estimatedCompletionTime: Date | null = null;
    if (dto.estimatedMinutes) {
      estimatedCompletionTime = new Date(
        Date.now() + dto.estimatedMinutes * 60000,
      );
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          restaurantId: businessId,
          customerId: dto.customerId || null,
          tableId: dto.tableId || null,
          tableNumber: dto.tableNumber || null,
          staffId,
          staffName,
          orderType: dto.orderType,
          customerInfo: (dto.customerInfo || {}) as object,
          items: orderItems as unknown as object[],
          pricing: pricing as unknown as object,
          discountsApplied: discountsApplied as unknown as object[],
          paymentStatus: 'pending',
          balanceDue: pricing.total,
          status: 'active',
          priority: dto.priority || 'normal',
          estimatedCompletionTime,
          timestamps: timestamps as unknown as object,
          auditTrail: auditTrail as unknown as object[],
        },
        include: {
          table: true,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId: staffId || null,
          action: 'order.create',
          resource: 'order',
          resourceId: created.id,
          details: {
            orderNumber,
            orderType: dto.orderType,
            itemCount: orderItems.length,
            total: pricing.total,
          } as object,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      return created;
    });

    // Increment order usage for subscription tracking
    await this.usageTrackingService.incrementOrderUsage(businessId);

    // Emit WebSocket event for real-time updates
    this.orderGateway.emitOrderCreated(businessId, order);

    return { message: 'Order created successfully', order };
  }

  async getOrders(
    businessId: string,
    options?: {
      status?: string;
      paymentStatus?: string;
      orderType?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Record<string, unknown> = {
      restaurantId: businessId,
      deletedAt: null,
    };

    if (options?.status) {
      where.status = options.status;
    }
    if (options?.paymentStatus) {
      where.paymentStatus = options.paymentStatus;
    }
    if (options?.orderType) {
      where.orderType = options.orderType;
    }
    if (options?.fromDate || options?.toDate) {
      where.createdAt = {};
      if (options?.fromDate) {
        (where.createdAt as Record<string, Date>).gte = options.fromDate;
      }
      if (options?.toDate) {
        (where.createdAt as Record<string, Date>).lte = options.toDate;
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          table: true,
          staff: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  async getOrderById(businessId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: businessId, deletedAt: null },
      include: {
        table: true,
        staff: {
          select: { id: true, name: true, email: true },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return { order };
  }

  async getOrderByNumber(businessId: string, orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, restaurantId: businessId, deletedAt: null },
      include: {
        table: true,
        staff: {
          select: { id: true, name: true, email: true },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return { order };
  }

  async getActiveOrders(businessId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: businessId,
        status: 'active',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        table: true,
        staff: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return { orders };
  }

  async updateOrderStatus(
    businessId: string,
    orderId: string,
    staffId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    if (existing.status === dto.status) {
      throw new BadRequestException(`Order is already ${dto.status}`);
    }

    // Validate status transitions — completed and cancelled are terminal states
    const validTransitions: Record<string, string[]> = {
      active: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    const allowed = validTransitions[existing.status];
    if (allowed && !allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition order from '${existing.status}' to '${dto.status}'`,
      );
    }

    const now = new Date().toISOString();
    const timestamps = existing.timestamps as unknown as OrderTimestamps;
    const auditTrail = existing.auditTrail as unknown as OrderAuditEntry[];

    // Update timestamps based on status
    if (dto.status === 'completed') {
      timestamps.completedAt = now;
    } else if (dto.status === 'cancelled') {
      timestamps.cancelledAt = now;
    }

    // Add audit entry
    auditTrail.push({
      action: `order.status_${dto.status}`,
      performedBy: staffId,
      performedAt: now,
      details: { reason: dto.reason, previousStatus: existing.status },
    });

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: dto.status,
        timestamps: timestamps as unknown as object,
        auditTrail: auditTrail as unknown as object[],
        actualCompletionTime:
          dto.status === 'completed' ? new Date() : undefined,
      },
      include: {
        table: true,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        restaurantId: businessId,
        userId: staffId,
        action: `order.${dto.status}`,
        resource: 'order',
        resourceId: order.id,
        details: {
          orderNumber: order.orderNumber,
          reason: dto.reason,
        } as object,
      },
    });

    // Auto-end table session when order is completed or cancelled
    if (
      (dto.status === 'completed' || dto.status === 'cancelled') &&
      existing.tableId
    ) {
      try {
        await this.tableService.endSession(
          businessId,
          existing.tableId,
          staffId,
        );
        this.logger.log(
          `Table session ended for table ${existing.tableId} (order ${dto.status})`,
        );
      } catch (err) {
        // Don't fail the order update if table session end fails
        this.logger.warn(
          `Failed to end table session for table ${existing.tableId}: ${err}`,
        );
      }
    }

    // Award loyalty points when order is completed
    if (dto.status === 'completed' && existing.customerId) {
      try {
        await this.loyaltyService.awardPointsForOrder(
          businessId,
          existing.customerId,
          orderId,
        );
      } catch (err) {
        this.logger.warn(`Failed to award loyalty points: ${err}`);
      }
    }

    // Deduct inventory when order is completed
    if (dto.status === 'completed') {
      try {
        const menu = await this.menuService.getMenu(businessId);
        const orderItems = existing.items as unknown as OrderItem[];
        const deductions: {
          inventoryItemId: string;
          quantity: number;
          unit: string;
        }[] = [];

        for (const orderItem of orderItems) {
          if (orderItem.status === 'cancelled') continue;
          const menuItem = menu.items.find(
            (mi) => mi.id === orderItem.menuItemId,
          );
          if (!menuItem?.ingredients?.length) continue;

          for (const ingredient of menuItem.ingredients as MenuItemIngredient[]) {
            deductions.push({
              inventoryItemId: ingredient.inventoryItemId,
              quantity: ingredient.quantityUsed * orderItem.quantity,
              unit: ingredient.unit,
            });
          }
        }

        if (deductions.length > 0) {
          await this.inventoryService.deductForOrder(
            businessId,
            orderId,
            existing.orderNumber,
            deductions,
            staffId,
            'System',
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to deduct inventory for order ${existing.orderNumber}: ${err}`,
        );
      }
    }

    // Emit WebSocket event for real-time updates
    if (dto.status === 'completed') {
      this.orderGateway.emitOrderCompleted(businessId, orderId);
    } else {
      this.orderGateway.emitOrderUpdated(businessId, order);
    }

    return { message: `Order ${dto.status}`, order };
  }

  async addItemsToOrder(
    businessId: string,
    orderId: string,
    staffId: string,
    dto: AddItemsToOrderDto,
  ) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    if (existing.status !== 'active') {
      throw new BadRequestException('Cannot modify a non-active order');
    }

    const now = new Date().toISOString();
    const existingItems = existing.items as unknown as OrderItem[];
    const auditTrail = existing.auditTrail as unknown as OrderAuditEntry[];

    // Create new items
    const newItems: OrderItem[] = dto.items.map((item) => ({
      id: uuidv4(),
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      basePrice: item.basePrice,
      totalPrice: this.calculateItemTotal(item),
      modifiers: item.modifiers,
      status: 'pending' as const,
    }));

    const allItems = [...existingItems, ...newItems];

    // Recalculate pricing
    const existingPricing = existing.pricing as unknown as OrderPricing;
    const pricing = this.calculatePricing(
      allItems,
      existingPricing.taxRate,
      existingPricing.discountType
        ? {
            type: existingPricing.discountType,
            value: existingPricing.discountValue,
          }
        : undefined,
      existingPricing.serviceCharge,
    );

    // Add audit entry
    auditTrail.push({
      action: 'order.items_added',
      performedBy: staffId,
      performedAt: now,
      details: {
        itemsAdded: newItems.length,
        newItemNames: newItems.map((i) => i.name),
      },
    });

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        items: allItems as unknown as object[],
        pricing: pricing as unknown as object,
        balanceDue:
          pricing.total -
          (Number(existingPricing.total) - Number(existing.balanceDue)),
        auditTrail: auditTrail as unknown as object[],
      },
      include: {
        table: true,
      },
    });

    return { message: 'Items added to order', order };
  }

  async updateItemQuantity(
    businessId: string,
    orderId: string,
    staffId: string,
    dto: UpdateItemQuantityDto,
  ) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    if (existing.status !== 'active') {
      throw new BadRequestException('Cannot modify a non-active order');
    }

    const items = existing.items as unknown as OrderItem[];
    const itemIndex = items.findIndex((i) => i.id === dto.itemId);

    if (itemIndex === -1) {
      throw new NotFoundException('Item not found in order');
    }

    const now = new Date().toISOString();
    const auditTrail = existing.auditTrail as unknown as OrderAuditEntry[];

    // Update quantity and recalculate total
    const item = items[itemIndex];
    const oldQuantity = item.quantity;
    item.quantity = dto.quantity;
    item.totalPrice = (item.totalPrice / oldQuantity) * dto.quantity;

    // Recalculate pricing
    const existingPricing = existing.pricing as unknown as OrderPricing;
    const pricing = this.calculatePricing(
      items,
      existingPricing.taxRate,
      existingPricing.discountType
        ? {
            type: existingPricing.discountType,
            value: existingPricing.discountValue,
          }
        : undefined,
      existingPricing.serviceCharge,
    );

    // Add audit entry
    auditTrail.push({
      action: 'order.item_quantity_updated',
      performedBy: staffId,
      performedAt: now,
      details: { itemId: dto.itemId, oldQuantity, newQuantity: dto.quantity },
    });

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        items: items as unknown as object[],
        pricing: pricing as unknown as object,
        balanceDue: pricing.total,
        auditTrail: auditTrail as unknown as object[],
      },
      include: {
        table: true,
      },
    });

    return { message: 'Item quantity updated', order };
  }

  async updateItemStatus(
    businessId: string,
    orderId: string,
    staffId: string,
    itemId: string,
    status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled',
  ) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    if (existing.status !== 'active') {
      throw new BadRequestException('Cannot modify a non-active order');
    }

    const items = existing.items as unknown as OrderItem[];
    const itemIndex = items.findIndex((i) => i.id === itemId);

    if (itemIndex === -1) {
      throw new NotFoundException('Item not found in order');
    }

    const now = new Date().toISOString();
    const auditTrail = existing.auditTrail as unknown as OrderAuditEntry[];

    // Update item status
    const oldStatus = items[itemIndex].status;
    items[itemIndex].status = status;

    // Add audit entry
    auditTrail.push({
      action: 'order.item_status_updated',
      performedBy: staffId,
      performedAt: now,
      details: { itemId, oldStatus, newStatus: status },
    });

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        items: items as unknown as object[],
        auditTrail: auditTrail as unknown as object[],
      },
      include: {
        table: true,
      },
    });

    // Emit WebSocket event for real-time updates
    this.orderGateway.emitItemStatusChanged(businessId, {
      orderId,
      itemId,
      status,
      order,
    });

    return { message: 'Item status updated', order };
  }

  async removeItemFromOrder(
    businessId: string,
    orderId: string,
    staffId: string,
    itemId: string,
  ) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    if (existing.status !== 'active') {
      throw new BadRequestException('Cannot modify a non-active order');
    }

    const items = existing.items as unknown as OrderItem[];
    const itemToRemove = items.find((i) => i.id === itemId);

    if (!itemToRemove) {
      throw new NotFoundException('Item not found in order');
    }

    const now = new Date().toISOString();
    const auditTrail = existing.auditTrail as unknown as OrderAuditEntry[];

    const filteredItems = items.filter((i) => i.id !== itemId);

    if (filteredItems.length === 0) {
      throw new BadRequestException(
        'Cannot remove the last item. Cancel the order instead.',
      );
    }

    // Recalculate pricing
    const existingPricing = existing.pricing as unknown as OrderPricing;
    const pricing = this.calculatePricing(
      filteredItems,
      existingPricing.taxRate,
      existingPricing.discountType
        ? {
            type: existingPricing.discountType,
            value: existingPricing.discountValue,
          }
        : undefined,
      existingPricing.serviceCharge,
    );

    // Add audit entry
    auditTrail.push({
      action: 'order.item_removed',
      performedBy: staffId,
      performedAt: now,
      details: { itemId, itemName: itemToRemove.name },
    });

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        items: filteredItems as unknown as object[],
        pricing: pricing as unknown as object,
        balanceDue: pricing.total,
        auditTrail: auditTrail as unknown as object[],
      },
      include: {
        table: true,
      },
    });

    return { message: 'Item removed from order', order };
  }

  async applyDiscount(
    businessId: string,
    orderId: string,
    staffId: string,
    dto: ApplyDiscountDto,
  ) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    if (existing.status !== 'active') {
      throw new BadRequestException('Cannot modify a non-active order');
    }

    const now = new Date().toISOString();
    const items = existing.items as unknown as OrderItem[];
    const existingPricing = existing.pricing as unknown as OrderPricing;
    const discountsApplied =
      existing.discountsApplied as unknown as OrderDiscount[];
    const auditTrail = existing.auditTrail as unknown as OrderAuditEntry[];

    // Calculate new pricing with discount
    const pricing = this.calculatePricing(
      items,
      existingPricing.taxRate,
      { type: dto.type, value: dto.value },
      existingPricing.serviceCharge,
    );

    // Add to discounts array
    discountsApplied.push({
      id: uuidv4(),
      code: dto.code,
      type: dto.type,
      value: dto.value,
      amount: pricing.discountAmount,
      reason: dto.reason,
    });

    // Add audit entry
    auditTrail.push({
      action: 'order.discount_applied',
      performedBy: staffId,
      performedAt: now,
      details: {
        type: dto.type,
        value: dto.value,
        amount: pricing.discountAmount,
      },
    });

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        pricing: pricing as unknown as object,
        discountsApplied: discountsApplied as unknown as object[],
        balanceDue: pricing.total,
        auditTrail: auditTrail as unknown as object[],
      },
      include: {
        table: true,
      },
    });

    return { message: 'Discount applied', order };
  }

  async getOrdersByTable(businessId: string, tableId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: businessId,
        tableId,
        status: 'active',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        staff: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return { orders };
  }

  async getOrderStats(businessId: string, date?: Date) {
    const startOfDay = date
      ? new Date(new Date(date).setHours(0, 0, 0, 0))
      : new Date(new Date().setHours(0, 0, 0, 0));
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const result = await this.prisma.$queryRaw<
      [{ total: bigint; completed_paid: bigint; completed: bigint; cancelled: bigint; active: bigint; total_revenue: Prisma.Decimal }]
    >`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed' AND payment_status = 'paid') as completed_paid,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COALESCE(SUM((pricing->>'total')::numeric) FILTER (WHERE status = 'completed' AND payment_status = 'paid'), 0) as total_revenue
      FROM orders
      WHERE restaurant_id = ${businessId}
        AND deleted_at IS NULL
        AND created_at >= ${startOfDay} AND created_at < ${endOfDay}
    `;

    const row = result[0];
    const totalRevenue = Number(row?.total_revenue ?? 0);
    const completedOrders = Number(row?.completed ?? 0);

    return {
      stats: {
        totalOrders: Number(row?.total ?? 0),
        activeOrders: Number(row?.active ?? 0),
        completedOrders,
        cancelledOrders: Number(row?.cancelled ?? 0),
        totalRevenue,
        averageOrderValue:
          completedOrders > 0 ? totalRevenue / completedOrders : 0,
      },
    };
  }

  async getTopSellingItems(
    businessId: string,
    limit: number = 5,
    days: number = 7,
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        category: string;
        quantity_sold: Prisma.Decimal;
        revenue: Prisma.Decimal;
      }>
    >`
      SELECT
        COALESCE(item->>'menuItemId', item->>'id', 'unknown') as id,
        COALESCE(item->>'name', 'Unknown') as name,
        COALESCE(item->>'category', 'Menu Item') as category,
        SUM(COALESCE((item->>'quantity')::int, 1)) as quantity_sold,
        SUM(COALESCE((item->>'totalPrice')::numeric, 0)) as revenue
      FROM orders, jsonb_array_elements(items) as item
      WHERE restaurant_id = ${businessId}
        AND status = 'completed'
        AND deleted_at IS NULL
        AND created_at >= ${startDate}
      GROUP BY item->>'menuItemId', item->>'id', item->>'name', item->>'category'
      ORDER BY quantity_sold DESC
      LIMIT ${limit}
    `;

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        quantitySold: Number(row.quantity_sold),
        revenue: Number(row.revenue),
      })),
    };
  }

  async getPeakHours(businessId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<
      Array<{ hour_value: number; order_count: bigint; revenue: Prisma.Decimal }>
    >`
      SELECT
        EXTRACT(HOUR FROM created_at)::int as hour_value,
        COUNT(*) as order_count,
        COALESCE(SUM((pricing->>'total')::numeric), 0) as revenue
      FROM orders
      WHERE restaurant_id = ${businessId}
        AND status = 'completed'
        AND deleted_at IS NULL
        AND created_at >= ${startDate}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY order_count DESC
      LIMIT 6
    `;

    const formatHour = (hour: number): string => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:00 ${period}`;
    };

    return {
      hours: rows.map((row) => ({
        hour: formatHour(row.hour_value),
        hourValue: row.hour_value,
        orderCount: Number(row.order_count),
        revenue: Number(row.revenue),
      })),
    };
  }

  async getRevenueTrends(businessId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<
      Array<{ date: string; revenue: Prisma.Decimal; orders: bigint }>
    >`
      SELECT
        DATE(created_at)::text as date,
        COALESCE(SUM((pricing->>'total')::numeric), 0) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE restaurant_id = ${businessId}
        AND status = 'completed'
        AND payment_status = 'paid'
        AND deleted_at IS NULL
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    return {
      trends: rows.map((row) => ({
        date: row.date,
        revenue: Number(row.revenue),
        orders: Number(row.orders),
      })),
    };
  }

  async softDelete(
    businessId: string,
    orderId: string,
    staffId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    if (existing.status === 'active') {
      throw new BadRequestException(
        'Cannot delete an active order. Cancel it first.',
      );
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.order.update({
        where: { id: orderId },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId: staffId,
          action: 'order.delete',
          resource: 'order',
          resourceId: orderId,
          details: { orderNumber: existing.orderNumber } as object,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      return deleted;
    });

    return { message: 'Order deleted successfully', order };
  }
}
