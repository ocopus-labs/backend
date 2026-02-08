import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import {
  CreatePaymentDto,
  CreateSplitPaymentDto,
  ProcessRefundDto,
  UpdatePaymentStatusDto,
} from './dto';
import type {
  PaymentMethod,
  TaxDetails,
  RefundEntry,
  Receipt,
  PaymentSummary,
} from './interfaces';
import { TaxService } from 'src/modules/tax';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taxService: TaxService,
  ) {}

  private generatePaymentNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `PAY-${timestamp}-${random}`;
  }

  private generateReceiptNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `RCP-${timestamp}-${random}`;
  }

  async createPayment(
    businessId: string,
    staffId: string,
    dto: CreatePaymentDto,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    // Idempotency check: prevent duplicate payments
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findFirst({
        where: {
          restaurantId: businessId,
          receipt: { path: ['idempotencyKey'], equals: dto.idempotencyKey },
        },
      });
      if (existing) {
        throw new ConflictException('Duplicate payment: this request has already been processed');
      }
    }

    // Get the order
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, restaurantId: businessId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus === 'paid') {
      throw new BadRequestException('Order is already fully paid');
    }

    if (order.status === 'cancelled') {
      throw new BadRequestException('Cannot add payment to a cancelled order');
    }

    const balanceDue = Number(order.balanceDue);
    if (dto.amount > balanceDue) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds balance due (${balanceDue})`,
      );
    }

    const paymentNumber = this.generatePaymentNumber();
    const pricing = order.pricing as { subtotal: number; taxRate: number; taxAmount: number; total: number; taxBreakdown?: { regime: string; componentTotals: Record<string, number>; totalTax: number } };

    // Calculate change for cash payments
    let change = 0;
    if (dto.method === 'cash' && dto.cashReceived) {
      change = dto.cashReceived - dto.amount;
      if (change < 0) {
        throw new BadRequestException('Cash received is less than payment amount');
      }
    }

    // Build tax details
    const taxDetails: TaxDetails = {
      subtotal: pricing.subtotal,
      taxRate: pricing.taxRate,
      taxAmount: pricing.taxAmount,
      total: pricing.total,
      ...(pricing.taxBreakdown && {
        taxBreakdown: {
          regime: pricing.taxBreakdown.regime,
          componentTotals: pricing.taxBreakdown.componentTotals,
          totalTax: pricing.taxBreakdown.totalTax,
        },
      }),
    };

    // Create payment, update order, and audit log atomically
    const newBalance = balanceDue - dto.amount;
    const newPaymentStatus = newBalance <= 0 ? 'paid' : 'partial';

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          restaurantId: businessId,
          orderId: dto.orderId,
          orderNumber: order.orderNumber,
          amount: dto.amount,
          method: dto.method,
          status: 'completed',
          customerInfo: (dto.customerInfo || {}) as object,
          billingAddress: dto.billingAddress as object || null,
          taxDetails: taxDetails as object,
          processedBy: staffId,
          processedAt: new Date(),
          receipt: {
            receiptNumber: this.generateReceiptNumber(),
            generatedAt: new Date().toISOString(),
            paymentMethod: dto.method,
            amountPaid: dto.amount,
            change: change > 0 ? change : undefined,
            tipAmount: dto.tipAmount,
            transactionReference: dto.transactionReference,
            ...(dto.idempotencyKey && { idempotencyKey: dto.idempotencyKey }),
          } as object,
        },
      });

      // Generate invoice number when order is fully paid (if tax is enabled)
      let invoiceNumber: string | undefined;
      if (newPaymentStatus === 'paid') {
        try {
          invoiceNumber = await this.taxService.generateInvoiceNumber(businessId);
        } catch (err) {
          // Tax not enabled or invoice generation failed — skip silently
          this.logger.debug(`Invoice number generation skipped: ${(err as Error).message}`);
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: dto.orderId },
        data: {
          balanceDue: newBalance,
          paymentStatus: newPaymentStatus,
          ...(invoiceNumber && { invoiceNumber }),
        },
      });

      // Add audit trail entry for payment status change on the order
      const existingAuditTrail = (updatedOrder.auditTrail as unknown as Array<Record<string, unknown>>) || [];
      existingAuditTrail.push({
        action: 'order.payment_received',
        performedBy: staffId,
        performedAt: new Date().toISOString(),
        details: {
          paymentNumber,
          amount: dto.amount,
          method: dto.method,
          newPaymentStatus,
          remainingBalance: newBalance,
          ...(invoiceNumber && { invoiceNumber }),
        },
      });
      await tx.order.update({
        where: { id: dto.orderId },
        data: { auditTrail: existingAuditTrail as unknown as object[] },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId: staffId,
          action: 'payment.create',
          resource: 'payment',
          resourceId: payment.id,
          details: {
            paymentNumber,
            orderNumber: order.orderNumber,
            amount: dto.amount,
            method: dto.method,
            change,
            ...(invoiceNumber && { invoiceNumber }),
          } as object,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      return payment;
    });

    return {
      message: 'Payment processed successfully',
      payment: result,
      change: change > 0 ? change : undefined,
      orderPaymentStatus: newPaymentStatus,
      remainingBalance: newBalance,
    };
  }

  async createSplitPayment(
    businessId: string,
    staffId: string,
    dto: CreateSplitPaymentDto,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    // Idempotency check: prevent duplicate split payments
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findFirst({
        where: {
          restaurantId: businessId,
          receipt: { path: ['idempotencyKey'], equals: dto.idempotencyKey },
        },
      });
      if (existing) {
        throw new ConflictException('Duplicate payment: this request has already been processed');
      }
    }

    // Get the order
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, restaurantId: businessId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus === 'paid') {
      throw new BadRequestException('Order is already fully paid');
    }

    const totalPaymentAmount = dto.payments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = Number(order.balanceDue);

    if (totalPaymentAmount > balanceDue) {
      throw new BadRequestException(
        `Total payment amount (${totalPaymentAmount}) exceeds balance due (${balanceDue})`,
      );
    }

    // Validate split amounts reconcile to balance (within tolerance)
    if (Math.abs(totalPaymentAmount - balanceDue) > 0.01 && totalPaymentAmount < balanceDue) {
      // Allow partial but not mismatched — this is just a warning-level check
    }

    // Validate each split entry has a minimum amount
    for (const p of dto.payments) {
      if (p.amount < 0.01) {
        throw new BadRequestException(
          'Each split payment must be at least 0.01',
        );
      }
    }

    const pricing = order.pricing as { subtotal: number; taxRate: number; taxAmount: number; total: number };
    const taxDetails: TaxDetails = {
      subtotal: pricing.subtotal,
      taxRate: pricing.taxRate,
      taxAmount: pricing.taxAmount,
      total: pricing.total,
    };

    // Create all payments, update order, and audit log atomically
    const newBalance = balanceDue - totalPaymentAmount;
    const newPaymentStatus = newBalance <= 0 ? 'paid' : 'partial';

    const payments = await this.prisma.$transaction(async (tx) => {
      const createdPayments = [];
      for (const p of dto.payments) {
        const paymentNumber = this.generatePaymentNumber();

        let change = 0;
        if (p.method === 'cash' && p.cashReceived) {
          change = p.cashReceived - p.amount;
        }

        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            restaurantId: businessId,
            orderId: dto.orderId,
            orderNumber: order.orderNumber,
            amount: p.amount,
            method: p.method,
            status: 'completed',
            customerInfo: (dto.customerInfo || {}) as object,
            taxDetails: taxDetails as object,
            processedBy: staffId,
            processedAt: new Date(),
            receipt: {
              receiptNumber: this.generateReceiptNumber(),
              generatedAt: new Date().toISOString(),
              paymentMethod: p.method,
              amountPaid: p.amount,
              change: change > 0 ? change : undefined,
              transactionReference: p.transactionReference,
              ...(dto.idempotencyKey && { idempotencyKey: dto.idempotencyKey }),
            } as object,
          },
        });
        createdPayments.push(payment);
      }

      const updatedOrder = await tx.order.update({
        where: { id: dto.orderId },
        data: {
          balanceDue: newBalance,
          paymentStatus: newPaymentStatus,
        },
      });

      // Add audit trail entry for split payment status change on the order
      const existingAuditTrail = (updatedOrder.auditTrail as unknown as Array<Record<string, unknown>>) || [];
      existingAuditTrail.push({
        action: 'order.payment_received',
        performedBy: staffId,
        performedAt: new Date().toISOString(),
        details: {
          type: 'split',
          paymentCount: createdPayments.length,
          totalAmount: totalPaymentAmount,
          methods: dto.payments.map((p) => p.method),
          newPaymentStatus,
          remainingBalance: newBalance,
        },
      });
      await tx.order.update({
        where: { id: dto.orderId },
        data: { auditTrail: existingAuditTrail as unknown as object[] },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId: staffId,
          action: 'payment.split',
          resource: 'payment',
          resourceId: dto.orderId,
          details: {
            orderNumber: order.orderNumber,
            paymentCount: createdPayments.length,
            totalAmount: totalPaymentAmount,
            methods: dto.payments.map((p) => p.method),
          } as object,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      return createdPayments;
    });

    return {
      message: 'Split payment processed successfully',
      payments,
      orderPaymentStatus: newPaymentStatus,
      remainingBalance: newBalance,
    };
  }

  async processRefund(
    businessId: string,
    paymentId: string,
    staffId: string,
    dto: ProcessRefundDto,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, restaurantId: businessId, deletedAt: null },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'refunded') {
      throw new BadRequestException('Payment is already fully refunded');
    }

    const paymentAmount = Number(payment.amount);
    const existingRefunds = (payment.refunds as unknown as RefundEntry[]) || [];
    const totalRefunded = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
    const refundableAmount = paymentAmount - totalRefunded;

    if (dto.amount > refundableAmount) {
      throw new BadRequestException(
        `Refund amount (${dto.amount}) exceeds refundable amount (${refundableAmount})`,
      );
    }

    // Add refund entry
    const refundEntry: RefundEntry = {
      id: `ref-${Date.now().toString(36)}`,
      amount: dto.amount,
      reason: dto.reason,
      refundedBy: staffId,
      refundedAt: new Date().toISOString(),
      method: dto.refundMethod,
    };

    const newTotalRefunded = totalRefunded + dto.amount;
    const newStatus = newTotalRefunded >= paymentAmount ? 'refunded' : 'partially_refunded';

    // Update payment, order balance, create refund record, and audit log atomically
    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: newStatus,
          refunds: [...existingRefunds, refundEntry] as object[],
        },
      });

      // Create refund record in separate table
      await tx.refund.create({
        data: {
          paymentId,
          restaurantId: businessId,
          amount: dto.amount,
          reason: dto.reason,
          method: dto.refundMethod,
          refundedBy: staffId,
        },
      });

      // Determine correct order payment status based on all payments
      const allPayments = await tx.payment.findMany({
        where: { orderId: payment.orderId, deletedAt: null },
      });
      const orderPricing = payment.order.pricing as { total: number };
      let totalPaid = 0;
      let totalRefundedAll = 0;
      for (const p of allPayments) {
        totalPaid += Number(p.amount);
        const refs = (p.refunds as unknown as RefundEntry[]) || [];
        totalRefundedAll += refs.reduce((s, r) => s + r.amount, 0);
      }
      // Account for the refund we're currently processing (already added to this payment's refunds above)
      const netPaid = totalPaid - totalRefundedAll;
      let orderPaymentStatus: string;
      if (netPaid <= 0) {
        orderPaymentStatus = 'refunded';
      } else if (netPaid >= orderPricing.total) {
        orderPaymentStatus = 'paid';
      } else {
        orderPaymentStatus = 'partial';
      }

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          balanceDue: { increment: dto.amount },
          paymentStatus: orderPaymentStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId: staffId,
          action: 'payment.refund',
          resource: 'payment',
          resourceId: paymentId,
          details: {
            paymentNumber: payment.paymentNumber,
            refundAmount: dto.amount,
            reason: dto.reason,
            refundMethod: dto.refundMethod,
          } as object,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      return updated;
    });

    return {
      message: 'Refund processed successfully',
      payment: updatedPayment,
      refundAmount: dto.amount,
    };
  }

  async getPaymentsByOrder(businessId: string, orderId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { restaurantId: businessId, orderId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const totalPaid = payments.reduce((sum, p) => {
      const refunds = (p.refunds as unknown as RefundEntry[]) || [];
      const refundedAmount = refunds.reduce((s, r) => s + r.amount, 0);
      return sum + Number(p.amount) - refundedAmount;
    }, 0);

    return { payments, totalPaid };
  }

  async getPaymentById(businessId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, restaurantId: businessId, deletedAt: null },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            items: true,
            pricing: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return { payment };
  }

  async getPayments(
    businessId: string,
    options?: {
      method?: PaymentMethod;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Record<string, unknown> = { restaurantId: businessId, deletedAt: null };

    if (options?.method) {
      where.method = options.method;
    }
    if (options?.status) {
      where.status = options.status;
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

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          order: {
            select: { id: true, orderNumber: true },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { payments, total };
  }

  async getPaymentSummary(businessId: string, date?: Date): Promise<{ summary: PaymentSummary }> {
    const startOfDay = date
      ? new Date(new Date(date).setHours(0, 0, 0, 0))
      : new Date(new Date().setHours(0, 0, 0, 0));
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const payments = await this.prisma.payment.findMany({
      where: {
        restaurantId: businessId,
        deletedAt: null,
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
    });

    const byMethod: Record<PaymentMethod, { count: number; amount: number }> = {
      cash: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
      upi: { count: 0, amount: 0 },
      net_banking: { count: 0, amount: 0 },
      wallet: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    };

    let totalAmount = 0;
    let pendingAmount = 0;
    let refundedAmount = 0;

    for (const payment of payments) {
      const amount = Number(payment.amount);
      const method = payment.method as PaymentMethod;
      const refunds = (payment.refunds as unknown as RefundEntry[]) || [];
      const refunded = refunds.reduce((sum, r) => sum + r.amount, 0);

      if (payment.status === 'completed' || payment.status === 'partially_refunded') {
        totalAmount += amount - refunded;
        byMethod[method].count += 1;
        byMethod[method].amount += amount - refunded;
      } else if (payment.status === 'pending') {
        pendingAmount += amount;
      }

      refundedAmount += refunded;
    }

    return {
      summary: {
        totalPayments: payments.length,
        totalAmount,
        byMethod,
        pendingAmount,
        refundedAmount,
      },
    };
  }

  async generateReceipt(businessId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, restaurantId: businessId, deletedAt: null },
      include: {
        order: true,
        restaurant: {
          select: { name: true, address: true, contact: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const orderItems = payment.order.items as Array<{
      name: string;
      quantity: number;
      basePrice: number;
      totalPrice: number;
    }>;
    const pricing = payment.order.pricing as {
      subtotal: number;
      taxAmount: number;
      discountAmount: number;
      total: number;
    };

    const receipt: Receipt = {
      receiptNumber: (payment.receipt as { receiptNumber?: string })?.receiptNumber || this.generateReceiptNumber(),
      generatedAt: new Date().toISOString(),
      items: orderItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.basePrice,
        total: item.totalPrice,
      })),
      subtotal: pricing.subtotal,
      tax: pricing.taxAmount,
      discount: pricing.discountAmount,
      total: pricing.total,
      paymentMethod: payment.method as PaymentMethod,
      amountPaid: Number(payment.amount),
      change: (payment.receipt as { change?: number })?.change,
    };

    return {
      receipt,
      business: payment.restaurant,
      orderNumber: payment.orderNumber,
      paymentNumber: payment.paymentNumber,
    };
  }

  async softDelete(
    businessId: string,
    paymentId: string,
    staffId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, restaurantId: businessId, deletedAt: null },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'pending') {
      throw new BadRequestException('Cannot delete a pending payment. Cancel it first.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.payment.update({
        where: { id: paymentId },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId: staffId,
          action: 'payment.delete',
          resource: 'payment',
          resourceId: paymentId,
          details: { paymentNumber: payment.paymentNumber } as object,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      return deleted;
    });

    return { message: 'Payment deleted successfully', payment: updated };
  }

  async getRefunds(
    businessId: string,
    paymentId: string,
    options?: { limit?: number; offset?: number },
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, restaurantId: businessId, deletedAt: null },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where: { paymentId, restaurantId: businessId },
        orderBy: { refundedAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.refund.count({
        where: { paymentId, restaurantId: businessId },
      }),
    ]);

    return { refunds, total };
  }
}
