import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
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
    const taxAmount = taxBreakdown ? taxBreakdown.totalTax : (subtotal * taxRate) / 100;
    const effectiveRate = taxBreakdown && subtotal > 0
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
    staffId: string,
    staffName: string,
    dto: CreateOrderDto,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    // Check subscription order limit
    const limitCheck = await this.usageTrackingService.checkOrderLimit(businessId);
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
          ? ((menuData.categories as any[]) || []).flatMap((cat: any) => cat.items || [])
          : [];

        const taxableItems = orderItems.map((item) => {
          const menuItem = allMenuItems.find((mi: any) => mi.id === item.menuItemId);
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
        performedBy: staffId,
        performedAt: now,
        details: { orderType: dto.orderType, itemCount: orderItems.length },
      },
    ];

    // Calculate estimated completion time
    let estimatedCompletionTime: Date | null = null;
    if (dto.estimatedMinutes) {
      estimatedCompletionTime = new Date(Date.now() + dto.estimatedMinutes * 60000);
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
          userId: staffId,
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
    const where: Record<string, unknown> = { restaurantId: businessId, deletedAt: null };

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
        actualCompletionTime: dto.status === 'completed' ? new Date() : undefined,
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
        details: { orderNumber: order.orderNumber, reason: dto.reason } as object,
      },
    });

    // Auto-end table session when order is completed or cancelled
    if ((dto.status === 'completed' || dto.status === 'cancelled') && existing.tableId) {
      try {
        await this.tableService.endSession(businessId, existing.tableId, staffId);
        this.logger.log(`Table session ended for table ${existing.tableId} (order ${dto.status})`);
      } catch (err) {
        // Don't fail the order update if table session end fails
        this.logger.warn(`Failed to end table session for table ${existing.tableId}: ${err}`);
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
        ? { type: existingPricing.discountType, value: existingPricing.discountValue! }
        : undefined,
      existingPricing.serviceCharge,
    );

    // Add audit entry
    auditTrail.push({
      action: 'order.items_added',
      performedBy: staffId,
      performedAt: now,
      details: { itemsAdded: newItems.length, newItemNames: newItems.map((i) => i.name) },
    });

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        items: allItems as unknown as object[],
        pricing: pricing as unknown as object,
        balanceDue: pricing.total - (Number(existingPricing.total) - Number(existing.balanceDue)),
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
        ? { type: existingPricing.discountType, value: existingPricing.discountValue! }
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
      throw new BadRequestException('Cannot remove the last item. Cancel the order instead.');
    }

    // Recalculate pricing
    const existingPricing = existing.pricing as unknown as OrderPricing;
    const pricing = this.calculatePricing(
      filteredItems,
      existingPricing.taxRate,
      existingPricing.discountType
        ? { type: existingPricing.discountType, value: existingPricing.discountValue! }
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
    const discountsApplied = existing.discountsApplied as unknown as OrderDiscount[];
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
      details: { type: dto.type, value: dto.value, amount: pricing.discountAmount },
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

    const [orders, completedOrders, cancelledOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          restaurantId: businessId,
          deletedAt: null,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
        select: {
          status: true,
          pricing: true,
          paymentStatus: true,
        },
      }),
      this.prisma.order.count({
        where: {
          restaurantId: businessId,
          status: 'completed',
          deletedAt: null,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.order.count({
        where: {
          restaurantId: businessId,
          status: 'cancelled',
          deletedAt: null,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
    ]);

    const totalRevenue = orders
      .filter((o) => o.status === 'completed' && o.paymentStatus === 'paid')
      .reduce((sum, o) => {
        const pricing = o.pricing as unknown as OrderPricing;
        return sum + pricing.total;
      }, 0);

    const activeOrders = orders.filter((o) => o.status === 'active').length;

    return {
      stats: {
        totalOrders: orders.length,
        activeOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue,
        averageOrderValue: completedOrders > 0 ? totalRevenue / completedOrders : 0,
      },
    };
  }

  async getTopSellingItems(businessId: string, limit: number = 5, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: businessId,
        status: 'completed',
        deletedAt: null,
        createdAt: { gte: startDate },
      },
      select: {
        items: true,
      },
    });

    // Aggregate items sold
    const itemStats = new Map<
      string,
      { name: string; category: string; quantitySold: number; revenue: number }
    >();

    for (const order of orders) {
      const items = order.items as unknown as OrderItem[];
      for (const item of items) {
        const key = item.menuItemId;
        const existing = itemStats.get(key);
        if (existing) {
          existing.quantitySold += item.quantity;
          existing.revenue += item.totalPrice;
        } else {
          itemStats.set(key, {
            name: item.name,
            category: 'Menu Item', // Default category, could be enhanced with menu lookup
            quantitySold: item.quantity,
            revenue: item.totalPrice,
          });
        }
      }
    }

    // Sort by quantity sold and take top items
    const sortedItems = Array.from(itemStats.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, limit);

    return { items: sortedItems };
  }

  async getPeakHours(businessId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: businessId,
        status: 'completed',
        deletedAt: null,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        pricing: true,
      },
    });

    // Aggregate by hour
    const hourlyStats = new Map<number, { orderCount: number; revenue: number }>();

    for (const order of orders) {
      const hour = order.createdAt.getHours();
      const pricing = order.pricing as unknown as OrderPricing;
      const existing = hourlyStats.get(hour);
      if (existing) {
        existing.orderCount += 1;
        existing.revenue += pricing.total;
      } else {
        hourlyStats.set(hour, { orderCount: 1, revenue: pricing.total });
      }
    }

    // Format hours and sort by order count
    const formatHour = (hour: number): string => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:00 ${period}`;
    };

    const peakHours = Array.from(hourlyStats.entries())
      .map(([hour, data]) => ({
        hour: formatHour(hour),
        hourValue: hour,
        ...data,
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 6);

    return { hours: peakHours };
  }

  async getRevenueTrends(businessId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: businessId,
        status: 'completed',
        paymentStatus: 'paid',
        deletedAt: null,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        pricing: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by date
    const dailyStats = new Map<string, { revenue: number; orders: number }>();

    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const pricing = order.pricing as unknown as OrderPricing;
      const existing = dailyStats.get(dateKey);
      if (existing) {
        existing.revenue += pricing.total;
        existing.orders += 1;
      } else {
        dailyStats.set(dateKey, { revenue: pricing.total, orders: 1 });
      }
    }

    const trends = Array.from(dailyStats.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    return { trends };
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
      throw new BadRequestException('Cannot delete an active order. Cancel it first.');
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
