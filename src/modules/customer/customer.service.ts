import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';
import type { CustomerStats } from './interfaces';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    businessId: string,
    dto: CreateCustomerDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    // Check phone uniqueness within this business
    const existing = await this.prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId: businessId, phone: dto.phone } },
    });

    if (existing) {
      throw new ConflictException('A customer with this phone number already exists');
    }

    const customer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          restaurantId: businessId,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          address: dto.address ? (dto.address as object) : undefined,
          notes: dto.notes,
          tags: dto.tags || [],
          createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId,
          action: 'customer.create',
          resource: 'customer',
          resourceId: created.id,
          details: { name: dto.name, phone: dto.phone } as object,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      return created;
    });

    return { message: 'Customer created successfully', customer };
  }

  async findAll(
    businessId: string,
    options?: {
      search?: string;
      status?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Record<string, unknown> = { restaurantId: businessId };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.search) {
      const search = options.search;
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (options?.tags && options.tags.length > 0) {
      where.tags = { hasSome: options.tags };
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 25,
        skip: options?.offset || 0,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { customers, total };
  }

  async findById(businessId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, restaurantId: businessId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return { customer };
  }

  async findByPhone(businessId: string, phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId: businessId, phone } },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return { customer };
  }

  async findWithOrders(businessId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, restaurantId: businessId },
      include: {
        orders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate order stats
    const totalOrders = customer.orders.length;
    const totalSpent = customer.orders
      .filter((o) => o.status === 'completed' && o.paymentStatus === 'paid')
      .reduce((sum, o) => {
        const pricing = o.pricing as Record<string, number>;
        return sum + (pricing.total || 0);
      }, 0);
    const lastOrder = customer.orders[0] || null;

    return {
      customer,
      orderStats: {
        totalOrders,
        totalSpent,
        lastOrderDate: lastOrder?.createdAt || null,
      },
    };
  }

  async update(
    businessId: string,
    customerId: string,
    dto: UpdateCustomerDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.customer.findFirst({
      where: { id: customerId, restaurantId: businessId },
    });

    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    // Check phone uniqueness if phone is being changed
    if (dto.phone && dto.phone !== existing.phone) {
      const duplicate = await this.prisma.customer.findUnique({
        where: { restaurantId_phone: { restaurantId: businessId, phone: dto.phone } },
      });
      if (duplicate) {
        throw new ConflictException('A customer with this phone number already exists');
      }
    }

    const customer = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.address !== undefined && { address: dto.address as object }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId,
          action: 'customer.update',
          resource: 'customer',
          resourceId: customerId,
          details: { changes: dto } as object,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      return updated;
    });

    return { message: 'Customer updated successfully', customer };
  }

  async delete(
    businessId: string,
    customerId: string,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.customer.findFirst({
      where: { id: customerId, restaurantId: businessId },
    });

    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    // Check if customer has orders
    const orderCount = await this.prisma.order.count({
      where: { customerId, deletedAt: null },
    });

    if (orderCount > 0) {
      throw new BadRequestException(
        `Cannot delete customer with ${orderCount} order(s). Set status to inactive instead.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id: customerId } });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId,
          action: 'customer.delete',
          resource: 'customer',
          resourceId: customerId,
          details: { name: existing.name, phone: existing.phone } as object,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });
    });

    return { message: 'Customer deleted successfully' };
  }

  async getStats(businessId: string): Promise<{ stats: CustomerStats }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, active, inactive, newThisMonth] = await Promise.all([
      this.prisma.customer.count({ where: { restaurantId: businessId } }),
      this.prisma.customer.count({ where: { restaurantId: businessId, status: 'active' } }),
      this.prisma.customer.count({ where: { restaurantId: businessId, status: 'inactive' } }),
      this.prisma.customer.count({
        where: { restaurantId: businessId, createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      stats: { total, active, inactive, newThisMonth },
    };
  }

  async exportCsv(
    businessId: string,
    options?: { status?: string; search?: string },
  ) {
    const where: Record<string, unknown> = { restaurantId: businessId };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.search) {
      const search = options.search;
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    return customers;
  }
}
