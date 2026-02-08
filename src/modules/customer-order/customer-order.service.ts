import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { OrderGateway } from 'src/modules/order/order.gateway';
import { QrService } from 'src/modules/qr/qr.service';
import { UsageTrackingService } from 'src/modules/subscription/usage-tracking.service';
import { DodoService } from 'src/modules/subscription/dodo/dodo.service';
import { TaxService } from 'src/modules/tax/tax.service';
import { calculateTaxForOrder } from 'src/modules/tax/utils/tax-calculator';
import { v4 as uuidv4 } from 'uuid';
import type { OrderingSettings } from './interfaces';
import { DEFAULT_ORDERING_SETTINGS } from './interfaces';
import type { CustomerPlaceOrderDto, UpdateOrderingSettingsDto } from './dto';
import type {
  OrderItem,
  OrderPricing,
  OrderTimestamps,
  OrderAuditEntry,
} from 'src/modules/order/interfaces';
import type { TaxBreakdown } from 'src/modules/tax/interfaces';

@Injectable()
export class CustomerOrderService {
  private readonly logger = new Logger(CustomerOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderGateway: OrderGateway,
    private readonly qrService: QrService,
    private readonly usageTrackingService: UsageTrackingService,
    private readonly dodoService: DodoService,
    private readonly taxService: TaxService,
  ) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  private validateModifierPrices(
    submitted: any,
    actual: any,
    itemName: string,
  ): void {
    // Validate size price
    if (submitted.size && actual.sizes) {
      const actualSize = actual.sizes.find(
        (s: any) =>
          s.id === submitted.size.id || s.name === submitted.size.name,
      );
      if (
        actualSize &&
        Math.abs(actualSize.price - submitted.size.price) > 0.01
      ) {
        throw new BadRequestException(
          `Size price for "${itemName}" has changed. Please refresh.`,
        );
      }
    }
    // Validate spice level price
    if (submitted.spiceLevel && actual.spiceLevels) {
      const actualSpice = actual.spiceLevels.find(
        (s: any) =>
          s.id === submitted.spiceLevel.id ||
          s.name === submitted.spiceLevel.name,
      );
      if (
        actualSpice &&
        Math.abs(actualSpice.price - submitted.spiceLevel.price) > 0.01
      ) {
        throw new BadRequestException(
          `Spice level price for "${itemName}" has changed. Please refresh.`,
        );
      }
    }
    // Validate add-on prices
    if (submitted.addOns && actual.addOns) {
      for (const submittedAddOn of submitted.addOns) {
        const actualAddOn = actual.addOns.find(
          (a: any) =>
            a.id === submittedAddOn.id || a.name === submittedAddOn.name,
        );
        if (
          actualAddOn &&
          Math.abs(actualAddOn.price - submittedAddOn.price) > 0.01
        ) {
          throw new BadRequestException(
            `Add-on "${submittedAddOn.name}" price for "${itemName}" has changed. Please refresh.`,
          );
        }
      }
    }
  }

  private calculateItemTotal(item: {
    basePrice: number;
    quantity: number;
    modifiers?: any;
  }): number {
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
    taxBreakdown?: TaxBreakdown,
  ): OrderPricing {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = taxBreakdown
      ? taxBreakdown.totalTax
      : (subtotal * taxRate) / 100;
    const effectiveRate =
      taxBreakdown && subtotal > 0
        ? Math.round((taxAmount / subtotal) * 10000) / 100
        : taxRate;

    const total = subtotal + taxAmount;

    return {
      subtotal,
      taxRate: effectiveRate,
      taxAmount,
      discountAmount: 0,
      total,
      ...(taxBreakdown && { taxBreakdown }),
    };
  }

  async getOrderingSettings(businessId: string): Promise<OrderingSettings> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const settings = restaurant.settings as Record<string, unknown>;
    return {
      ...DEFAULT_ORDERING_SETTINGS,
      ...(settings?.ordering as Partial<OrderingSettings>),
    };
  }

  async updateOrderingSettings(
    businessId: string,
    dto: UpdateOrderingSettingsDto,
    userId: string,
  ): Promise<OrderingSettings> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const existingSettings = restaurant.settings as Record<string, unknown>;
    const currentOrdering = {
      ...DEFAULT_ORDERING_SETTINGS,
      ...(existingSettings?.ordering as Partial<OrderingSettings>),
    };

    const newOrdering: OrderingSettings = {
      ...currentOrdering,
      ...dto,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.restaurant.update({
        where: { id: businessId },
        data: {
          settings: {
            ...existingSettings,
            ordering: newOrdering,
          } as object,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId,
          action: 'ordering.settings_updated',
          resource: 'ordering',
          details: { changes: dto } as object,
        },
      });
    });

    return newOrdering;
  }

  async getPublicBusinessInfo(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        logo: true,
        description: true,
        settings: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const settings = restaurant.settings as Record<string, unknown>;
    const ordering = {
      ...DEFAULT_ORDERING_SETTINGS,
      ...(settings?.ordering as Partial<OrderingSettings>),
    };

    if (!ordering.selfOrderEnabled) {
      throw new BadRequestException(
        'Self-ordering is not enabled for this business',
      );
    }

    // Extract only the currency from settings for public display
    const currency = (settings?.currency as string) || 'INR';

    return {
      business: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        type: restaurant.type,
        logo: restaurant.logo,
        description: restaurant.description,
        currency,
        ordering: {
          requirePrepayment: ordering.requirePrepayment,
        },
        paymentMethods: {
          dodo: this.dodoService.isOrderPaymentConfigured(),
        },
      },
    };
  }

  async getPublicMenu(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true, settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const settings = restaurant.settings as Record<string, unknown>;
    const ordering = {
      ...DEFAULT_ORDERING_SETTINGS,
      ...(settings?.ordering as Partial<OrderingSettings>),
    };

    if (!ordering.selfOrderEnabled) {
      throw new BadRequestException(
        'Self-ordering is not enabled for this business',
      );
    }

    const menuData = await this.prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id },
      select: { categories: true },
    });

    if (!menuData) {
      return { categories: [] };
    }

    // menuData.categories is { categories: MenuCategory[], items: MenuItem[] }
    // Items are flat with categoryId, NOT nested inside categories
    const data = menuData.categories as unknown as {
      categories: any[];
      items: any[];
    };
    const cats = data?.categories || [];
    const items = (data?.items || []).filter(
      (item: any) => item.isAvailable !== false,
    );

    const categories = cats
      .filter((cat: any) => cat.isActive !== false)
      .map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        image: cat.image,
        items: items.filter((item: any) => item.categoryId === cat.id),
      }))
      .filter((cat: any) => cat.items.length > 0);

    return { categories };
  }

  /**
   * Per-phone cooldown: max 3 orders per phone per 10 minutes.
   * Simple in-memory map (cleared on restart, good enough for single-instance).
   */
  private phoneOrderTimestamps = new Map<string, number[]>();
  private static readonly PHONE_COOLDOWN_WINDOW_MS = 10 * 60 * 1000; // 10 min
  private static readonly PHONE_COOLDOWN_MAX_ORDERS = 3;

  private checkPhoneCooldown(phone: string, businessId: string): void {
    const key = `${businessId}:${phone}`;
    const now = Date.now();
    const cutoff = now - CustomerOrderService.PHONE_COOLDOWN_WINDOW_MS;

    const timestamps = (this.phoneOrderTimestamps.get(key) || []).filter(
      (t) => t > cutoff,
    );

    if (timestamps.length >= CustomerOrderService.PHONE_COOLDOWN_MAX_ORDERS) {
      throw new BadRequestException(
        'Too many orders from this phone number. Please wait a few minutes.',
      );
    }

    timestamps.push(now);
    this.phoneOrderTimestamps.set(key, timestamps);
  }

  async placeCustomerOrder(slug: string, dto: CustomerPlaceOrderDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true, name: true, settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const settings = restaurant.settings as Record<string, unknown>;
    const ordering = {
      ...DEFAULT_ORDERING_SETTINGS,
      ...(settings?.ordering as Partial<OrderingSettings>),
    };

    if (!ordering.selfOrderEnabled) {
      throw new BadRequestException(
        'Self-ordering is not enabled for this business',
      );
    }

    // Per-phone spam protection
    this.checkPhoneCooldown(dto.customerPhone, restaurant.id);

    // Validate table exists
    const table = await this.prisma.table.findUnique({
      where: {
        restaurantId_tableNumber: {
          restaurantId: restaurant.id,
          tableNumber: dto.tableNumber,
        },
      },
    });

    if (!table) {
      throw new NotFoundException(`Table ${dto.tableNumber} not found`);
    }

    // Check subscription order limit
    const limitCheck = await this.usageTrackingService.checkOrderLimit(
      restaurant.id,
    );
    if (!limitCheck.allowed) {
      throw new BadRequestException(
        'This business has reached its order limit. Please try again later.',
      );
    }

    // ── Server-side price validation ──
    // Load actual menu to verify prices — never trust the client
    const menuData = await this.prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id },
      select: { categories: true },
    });
    const menuJson = menuData?.categories as unknown as {
      categories: any[];
      items: any[];
    } | null;
    const allMenuItems: any[] = menuJson?.items || [];

    // Build a lookup map: menuItemId → menu item
    const menuItemMap = new Map<string, any>();
    for (const mi of allMenuItems) {
      menuItemMap.set(mi.id, mi);
    }

    // Validate each item's price against the actual menu
    for (const dtoItem of dto.items) {
      const menuItem = menuItemMap.get(dtoItem.menuItemId);
      if (!menuItem) {
        throw new BadRequestException(
          `Menu item "${dtoItem.name}" is no longer available`,
        );
      }
      if (menuItem.isAvailable === false) {
        throw new BadRequestException(
          `"${menuItem.name}" is currently unavailable`,
        );
      }
      // Verify base price matches (allow tiny floating-point tolerance)
      if (Math.abs(menuItem.price - dtoItem.basePrice) > 0.01) {
        this.logger.warn(
          `Price mismatch for ${dtoItem.menuItemId}: client=${dtoItem.basePrice}, actual=${menuItem.price}`,
        );
        throw new BadRequestException(
          `Price for "${menuItem.name}" has changed. Please refresh and try again.`,
        );
      }
      // Validate modifier prices if present
      if (dtoItem.modifiers && menuItem.modifiers) {
        this.validateModifierPrices(
          dtoItem.modifiers,
          menuItem.modifiers,
          menuItem.name,
        );
      }
    }

    // Find or create customer by phone
    let customer = await this.prisma.customer.findUnique({
      where: {
        restaurantId_phone: {
          restaurantId: restaurant.id,
          phone: dto.customerPhone,
        },
      },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          restaurantId: restaurant.id,
          name: dto.customerName,
          phone: dto.customerPhone,
          createdBy: 'customer_self_order',
        },
      });
    }

    // Build order items using VERIFIED prices from menu
    const orderNumber = this.generateOrderNumber();
    const now = new Date().toISOString();
    const trackingToken = uuidv4();

    const orderItems: OrderItem[] = dto.items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId)!;
      return {
        id: uuidv4(),
        menuItemId: item.menuItemId,
        name: menuItem.name, // Use server name, not client-provided
        quantity: item.quantity,
        basePrice: menuItem.price, // Use server price
        totalPrice: this.calculateItemTotal({
          basePrice: menuItem.price,
          quantity: item.quantity,
          modifiers: item.modifiers,
        }),
        modifiers: item.modifiers,
        status: 'pending' as const,
      };
    });

    // Calculate tax breakdown
    let taxBreakdown: TaxBreakdown | undefined;
    try {
      const taxSettings = await this.taxService.getSettings(restaurant.id);
      if (taxSettings.enabled) {
        const taxableItems = orderItems.map((item) => {
          const menuItem = menuItemMap.get(item.menuItemId);
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

    const pricing = this.calculatePricing(orderItems, 0, taxBreakdown);

    const timestamps: OrderTimestamps = { placedAt: now };
    const auditTrail: OrderAuditEntry[] = [
      {
        action: 'order.create',
        performedBy: 'customer',
        performedAt: now,
        details: {
          orderType: 'dine_in',
          orderSource: 'customer_qr',
          itemCount: orderItems.length,
          customerName: dto.customerName,
        },
      },
    ];

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          restaurantId: restaurant.id,
          customerId: customer.id,
          tableId: table.id,
          tableNumber: dto.tableNumber,
          staffId: null,
          staffName: null,
          orderSource: 'customer_qr',
          orderType: 'dine_in',
          customerInfo: {
            name: dto.customerName,
            phone: dto.customerPhone,
            trackingToken,
          } as object,
          items: orderItems as unknown as object[],
          pricing: pricing as unknown as object,
          discountsApplied: [],
          paymentStatus: 'pending',
          balanceDue: pricing.total,
          status: 'active',
          priority: 'normal',
          timestamps: timestamps as unknown as object,
          auditTrail: auditTrail as unknown as object[],
        },
        include: { table: true },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: restaurant.id,
          userId: null,
          action: 'order.create',
          resource: 'order',
          resourceId: created.id,
          details: {
            orderNumber,
            orderSource: 'customer_qr',
            customerName: dto.customerName,
            tableNumber: dto.tableNumber,
            total: pricing.total,
          } as object,
        },
      });

      return created;
    });

    // Increment order usage
    await this.usageTrackingService.incrementOrderUsage(restaurant.id);

    // Emit WebSocket event — POS sees the order immediately
    this.orderGateway.emitOrderCreated(restaurant.id, order);

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items,
        pricing: order.pricing,
        tableNumber: order.tableNumber,
        createdAt: order.createdAt,
      },
      trackingToken,
    };
  }

  async getOrderByToken(trackingToken: string) {
    // Search for tracking token in customerInfo JSON
    const orders = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        customerInfo: {
          path: ['trackingToken'],
          equals: trackingToken,
        },
      },
      include: { table: true },
      take: 1,
    });

    if (orders.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const order = orders[0];
    const pricing = order.pricing as Record<string, unknown>;

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items,
        pricing,
        tableNumber: order.tableNumber,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        estimatedCompletionTime: order.estimatedCompletionTime,
      },
    };
  }

  async createCustomerPayment(
    trackingToken: string,
    dto: { amount: number; method: string; transactionReference?: string },
  ) {
    const orders = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        customerInfo: {
          path: ['trackingToken'],
          equals: trackingToken,
        },
      },
      take: 1,
    });

    if (orders.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const order = orders[0];
    const pricing = order.pricing as Record<string, number>;

    if (order.paymentStatus === 'paid') {
      throw new BadRequestException('Order is already paid');
    }

    // Validate payment amount matches order total (tolerance for rounding)
    const orderTotal = pricing.total || 0;
    if (Math.abs(dto.amount - orderTotal) > 1) {
      this.logger.warn(
        `Payment amount mismatch for order ${order.orderNumber}: submitted=${dto.amount}, expected=${orderTotal}`,
      );
      throw new BadRequestException(
        'Payment amount does not match order total',
      );
    }

    const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          restaurantId: order.restaurantId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentNumber,
          amount: orderTotal, // Use server-side total, not client amount
          method: dto.method,
          status: dto.transactionReference ? 'completed' : 'pending',
          gatewayTransactionId: dto.transactionReference || null,
          customerInfo: {
            source: 'customer_qr',
            trackingToken,
          } as object,
          taxDetails: {} as object,
          processedBy: null,
          processedAt: dto.transactionReference ? new Date() : null,
        },
      });

      // Update order payment status
      const totalPaid = orderTotal;
      const balanceDue = Math.max(0, orderTotal - totalPaid);
      const paymentStatus = balanceDue <= 0 ? 'paid' : 'partial';

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus,
          balanceDue,
        },
      });

      return created;
    });

    return { payment, message: 'Payment recorded' };
  }

  async generatePublicPaymentQr(slug: string, amount: number, note?: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    return this.qrService.generatePaymentQr(restaurant.id, amount, note);
  }

  /**
   * Create a Dodo Payments checkout session for an order.
   * Returns { checkoutUrl, sessionId } or null if Dodo not configured.
   */
  async createDodoPaymentSession(trackingToken: string, returnUrl: string) {
    if (!this.dodoService.isOrderPaymentConfigured()) {
      return null;
    }

    const orders = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        customerInfo: {
          path: ['trackingToken'],
          equals: trackingToken,
        },
      },
      take: 1,
    });

    if (orders.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const order = orders[0];

    if (order.paymentStatus === 'paid') {
      throw new BadRequestException('Order is already paid');
    }

    const pricing = order.pricing as Record<string, number>;
    const customerInfo = order.customerInfo as Record<string, string>;
    const totalAmount = pricing.total || 0;

    // Dodo expects amount in smallest currency unit (paise for INR)
    const amountInSmallestUnit = Math.round(totalAmount * 100);

    try {
      const result = await this.dodoService.createOrderPaymentCheckout({
        orderId: order.id,
        orderNumber: order.orderNumber,
        trackingToken,
        businessId: order.restaurantId,
        amountInSmallestUnit,
        customerName: customerInfo.name || 'Customer',
        customerPhone: customerInfo.phone || '',
        returnUrl,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Dodo checkout creation failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'Payment checkout unavailable. Please try again.',
      );
    }
  }

  /**
   * Check if Dodo payment is configured for order payments.
   */
  isDodoPaymentAvailable(): boolean {
    return this.dodoService.isOrderPaymentConfigured();
  }
}
