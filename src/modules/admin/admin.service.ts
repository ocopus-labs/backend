import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { BulkUserActionDto, BulkUserAction } from './dto/bulk-user-action.dto';
import { BulkBusinessActionDto, BulkBusinessAction } from './dto/bulk-business-action.dto';
import { BulkSubscriptionActionDto, BulkSubscriptionAction } from './dto/bulk-subscription-action.dto';

const BUSINESS_SORT_ALLOWLIST = ['name', 'createdAt', 'status', 'type', 'updatedAt'];
const USER_SORT_ALLOWLIST = ['name', 'email', 'createdAt', 'role', 'updatedAt'];
const WEBHOOK_SORT_ALLOWLIST = ['createdAt', 'provider', 'eventType', 'status'];
const MAX_PAGE_LIMIT = 100;

export interface LiveStats {
  ordersToday: { count: number; revenue: number };
  paymentsToday: { count: number; amount: number };
  activeBusinesses: number;
  newUsersToday: number;
  webhookHealth: { processed: number; failed: number; pending: number };
  recentErrors: { message: string; timestamp: string; source: string }[];
  ordersPerHour: { hour: string; count: number }[];
  revenuePerHour: { hour: string; amount: number }[];
}

export interface PlatformStats {
  totalBusinesses: number;
  activeBusinesses: number;
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  businessesByType: Record<string, number>;
  businessesByStatus: Record<string, number>;
  recentBusinesses: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    createdAt: Date;
  }>;
  recentUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    createdAt: Date;
  }>;
  subscriptionStats: {
    total: number;
    active: number;
    canceled: number;
    byPlan: Record<string, number>;
  };
  growthMetrics: {
    businessesThisMonth: number;
    usersThisMonth: number;
    ordersThisMonth: number;
    revenueThisMonth: number;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BusinessListFilters {
  status?: string;
  type?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserListFilters {
  banned?: boolean;
  search?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WebhookEventFilters {
  provider?: string;
  status?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  async getPlatformStats(): Promise<PlatformStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Parallel queries for better performance
    const [
      totalBusinesses,
      activeBusinesses,
      totalUsers,
      totalOrders,
      businessesByType,
      businessesByStatus,
      recentBusinesses,
      recentUsers,
      totalSubscriptions,
      activeSubscriptions,
      canceledSubscriptions,
      subscriptionsByPlan,
      businessesThisMonth,
      usersThisMonth,
      ordersThisMonth,
      paymentsAggregate,
      paymentsThisMonth,
    ] = await Promise.all([
      // Total businesses
      this.prisma.restaurant.count(),
      // Active businesses
      this.prisma.restaurant.count({ where: { status: 'active' } }),
      // Total users
      this.prisma.user.count(),
      // Total orders
      this.prisma.order.count(),
      // Businesses by type
      this.prisma.restaurant.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      // Businesses by status
      this.prisma.restaurant.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      // Recent businesses
      this.prisma.restaurant.findMany({
        select: { id: true, name: true, type: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Recent users
      this.prisma.user.findMany({
        select: { id: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Total subscriptions
      this.prisma.subscription.count(),
      // Active subscriptions
      this.prisma.subscription.count({ where: { status: 'active' } }),
      // Canceled subscriptions
      this.prisma.subscription.count({ where: { status: 'canceled' } }),
      // Subscriptions by plan
      this.prisma.subscription.groupBy({
        by: ['planId'],
        _count: { _all: true },
      }),
      // Businesses this month
      this.prisma.restaurant.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      // Users this month
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      // Orders this month
      this.prisma.order.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      // Total revenue from completed payments
      this.prisma.payment.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true },
      }),
      // Revenue this month
      this.prisma.payment.aggregate({
        where: {
          status: 'completed',
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    // Process businesses by type
    const typeStats: Record<string, number> = {};
    for (const item of businessesByType) {
      typeStats[item.type] = item._count.id;
    }

    // Process businesses by status
    const statusStats: Record<string, number> = {};
    for (const item of businessesByStatus) {
      statusStats[item.status] = item._count.id;
    }

    // Process subscription stats
    const byPlan: Record<string, number> = {};
    if (subscriptionsByPlan.length > 0) {
      const planIds = subscriptionsByPlan.map(s => s.planId);
      const plans = await this.prisma.subscriptionPlan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, name: true },
      });
      const planNameMap = new Map(plans.map(p => [p.id, p.name]));
      for (const group of subscriptionsByPlan) {
        const planName = planNameMap.get(group.planId) || String(group.planId);
        byPlan[planName] = group._count._all;
      }
    }
    const subscriptionStats = {
      total: totalSubscriptions,
      active: activeSubscriptions,
      canceled: canceledSubscriptions,
      byPlan,
    };

    return {
      totalBusinesses,
      activeBusinesses,
      totalUsers,
      totalOrders,
      totalRevenue: Number(paymentsAggregate._sum.amount || 0),
      businessesByType: typeStats,
      businessesByStatus: statusStats,
      recentBusinesses,
      recentUsers,
      subscriptionStats,
      growthMetrics: {
        businessesThisMonth,
        usersThisMonth,
        ordersThisMonth,
        revenueThisMonth: Number(paymentsThisMonth._sum.amount || 0),
      },
    };
  }

  async getLiveStats(): Promise<LiveStats> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Helper function to convert BigInt values to numbers
    const convertBigIntToNumber = (data: any[]): any[] => {
      return data.map((row) => {
        const converted: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          converted[key] = typeof value === 'bigint' ? Number(value) : value;
        }
        return converted;
      });
    };

    const [
      ordersTodayCount,
      ordersTodayRevenue,
      paymentsTodayCount,
      paymentsTodayAmount,
      activeBusinesses,
      newUsersToday,
      webhookGroupBy,
      recentFailedWebhooks,
      ordersPerHourRaw,
    ] = await Promise.all([
      // Orders today count
      this.prisma.order.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // Orders today revenue
      this.prisma.order.findMany({
        where: { createdAt: { gte: todayStart } },
        select: { pricing: true },
      }),
      // Payments today count
      this.prisma.payment.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // Payments today amount
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: todayStart }, status: 'completed' },
        _sum: { amount: true },
      }),
      // Active businesses (businesses with orders today)
      this.prisma.order.groupBy({
        by: ['restaurantId'],
        where: { createdAt: { gte: todayStart } },
      }),
      // New users today
      this.prisma.user.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // Webhook health
      this.prisma.webhookEvent.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      // Recent failed webhook events (last 5)
      this.prisma.webhookEvent.findMany({
        where: { status: 'failed' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          errorMessage: true,
          createdAt: true,
          provider: true,
          eventType: true,
        },
      }),
      // Orders per hour (last 24 hours) - raw SQL for hourly grouping
      this.prisma.$queryRaw`
        SELECT
          to_char(created_at, 'HH24:00') as hour,
          COUNT(*) as count,
          COALESCE(SUM(CAST((pricing->>'total') AS DECIMAL)), 0) as revenue
        FROM orders
        WHERE created_at >= ${last24h}
        GROUP BY to_char(created_at, 'HH24:00')
        ORDER BY hour ASC
      `,
    ]);

    // Calculate orders today revenue from pricing JSON
    let todayRevenue = 0;
    for (const order of ordersTodayRevenue) {
      const pricing = order.pricing as Record<string, any> | null;
      if (pricing?.total) {
        todayRevenue += Number(pricing.total);
      }
    }

    // Process webhook health
    const webhookHealth = { processed: 0, failed: 0, pending: 0 };
    for (const group of webhookGroupBy) {
      if (group.status === 'processed') {
        webhookHealth.processed = group._count._all;
      } else if (group.status === 'failed') {
        webhookHealth.failed = group._count._all;
      } else if (group.status === 'pending') {
        webhookHealth.pending = group._count._all;
      }
    }

    // Process recent errors
    const recentErrors = recentFailedWebhooks.map((webhook) => ({
      message: webhook.errorMessage || 'Unknown error',
      timestamp: webhook.createdAt.toISOString(),
      source: `${webhook.provider}/${webhook.eventType}`,
    }));

    // Process orders per hour data
    const ordersPerHourData = convertBigIntToNumber(ordersPerHourRaw as any[]);
    const ordersPerHour = ordersPerHourData.map((row) => ({
      hour: String(row.hour),
      count: Number(row.count),
    }));
    const revenuePerHour = ordersPerHourData.map((row) => ({
      hour: String(row.hour),
      amount: Number(row.revenue),
    }));

    return {
      ordersToday: { count: ordersTodayCount, revenue: todayRevenue },
      paymentsToday: {
        count: paymentsTodayCount,
        amount: Number(paymentsTodayAmount._sum.amount || 0),
      },
      activeBusinesses: activeBusinesses.length,
      newUsersToday,
      webhookHealth,
      recentErrors,
      ordersPerHour,
      revenuePerHour,
    };
  }

  async listAllBusinesses(
    page: number = 1,
    limit: number = 20,
    filters: BusinessListFilters = {},
  ): Promise<PaginatedResult<any>> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_PAGE_LIMIT);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.RestaurantWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.RestaurantOrderByWithRelationInput = {};
    if (filters.sortBy) {
      if (!BUSINESS_SORT_ALLOWLIST.includes(filters.sortBy)) {
        throw new BadRequestException(`Invalid sortBy field: ${filters.sortBy}. Allowed: ${BUSINESS_SORT_ALLOWLIST.join(', ')}`);
      }
      orderBy[filters.sortBy as keyof Prisma.RestaurantOrderByWithRelationInput] =
        filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy,
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              orders: true,
              businessUsers: true,
              tables: true,
            },
          },
        },
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getBusinessDetails(id: string): Promise<any> {
    const business = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
        businessUsers: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: {
            orders: true,
            payments: true,
            tables: true,
            menuItems: true,
            inventoryItems: true,
            expenses: true,
          },
        },
      },
    });

    if (!business) {
      return null;
    }

    // Get recent orders and revenue
    const [recentOrders, totalRevenue] = await Promise.all([
      this.prisma.order.findMany({
        where: { restaurantId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          pricing: true,
          createdAt: true,
        },
      }),
      this.prisma.payment.aggregate({
        where: { restaurantId: id, status: 'completed' },
        _sum: { amount: true },
      }),
    ]);

    return {
      ...business,
      recentOrders,
      totalRevenue: Number(totalRevenue._sum.amount || 0),
    };
  }

  async updateBusinessStatus(
    id: string,
    status: string,
    context?: { userId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.restaurant.findUnique({ where: { id }, select: { status: true } });
      const business = await tx.restaurant.update({
        where: { id },
        data: { status },
      });

      if (context?.userId) {
        await tx.auditLog.create({
          data: {
            userId: context.userId,
            action: 'business.status_update',
            resource: 'business',
            resourceId: id,
            restaurantId: id,
            details: { status, previousStatus: previous?.status },
            ipAddress: context.ipAddress || null,
            userAgent: context.userAgent || null,
          },
        });
      }

      return business;
    });
  }

  async listAllUsers(
    page: number = 1,
    limit: number = 20,
    filters: UserListFilters = {},
  ): Promise<PaginatedResult<any>> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_PAGE_LIMIT);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.UserWhereInput = {};

    if (filters.banned !== undefined) {
      where.banned = filters.banned;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.role) {
      where.role = filters.role;
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (filters.sortBy) {
      if (!USER_SORT_ALLOWLIST.includes(filters.sortBy)) {
        throw new BadRequestException(`Invalid sortBy field: ${filters.sortBy}. Allowed: ${USER_SORT_ALLOWLIST.join(', ')}`);
      }
      orderBy[filters.sortBy as keyof Prisma.UserOrderByWithRelationInput] =
        filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          banned: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              businessUsers: true,
              ownedRestaurants: true,
              orders: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getUserDetails(id: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        businessUsers: {
          include: {
            restaurant: {
              select: { id: true, name: true, slug: true, type: true, status: true },
            },
          },
        },
        ownedRestaurants: {
          select: { id: true, name: true, slug: true, type: true, status: true, createdAt: true },
        },
        subscriptions: {
          include: {
            plan: true,
          },
        },
        _count: {
          select: {
            orders: true,
            sessions: true,
          },
        },
      },
    });
  }

  async updateUserGlobalRole(
    userId: string,
    role: string,
    context?: { adminId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<any> {
    const previousUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    this.logger.log(
      `Admin ${context?.adminId} updated user ${userId} role: ${previousUser?.role} → ${role} [ip=${context?.ipAddress}]`,
    );

    return user;
  }

  async getAuditLogs(
    page: number = 1,
    limit: number = 50,
    filters: { userId?: string; resource?: string; action?: string; startDate?: Date; endDate?: Date } = {},
  ): Promise<PaginatedResult<any>> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_PAGE_LIMIT);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.AuditLogWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.resource) {
      where.resource = filters.resource;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as any).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as any).lte = filters.endDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          restaurant: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getPlatformAnalytics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }
    if (endDate && isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid endDate');
    }
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = endDate || now;

    // Helper function to convert BigInt values to numbers
    const convertBigIntToNumber = (data: any[]): any[] => {
      return data.map((row) => {
        const converted: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          converted[key] = typeof value === 'bigint' ? Number(value) : value;
        }
        return converted;
      });
    };

    // Get daily stats
    const dailyStatsRaw = await this.prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as orders_count,
        COALESCE(SUM(CAST((pricing->>'total') AS DECIMAL)), 0) as revenue
      FROM orders
      WHERE created_at >= ${start} AND created_at <= ${end}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Get user growth
    const userGrowthRaw = await this.prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as new_users
      FROM users
      WHERE created_at >= ${start} AND created_at <= ${end}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Get business growth
    const businessGrowthRaw = await this.prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as new_businesses
      FROM restaurants
      WHERE created_at >= ${start} AND created_at <= ${end}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Get top performing businesses
    const topBusinessesRaw = await this.prisma.$queryRaw`
      SELECT
        r.id,
        r.name,
        r.type,
        COUNT(o.id) as order_count,
        COALESCE(SUM(CAST((o.pricing->>'total') AS DECIMAL)), 0) as total_revenue
      FROM restaurants r
      LEFT JOIN orders o ON r.id = o.restaurant_id
      WHERE o.created_at >= ${start} AND o.created_at <= ${end}
      GROUP BY r.id, r.name, r.type
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    return {
      period: { start, end },
      dailyStats: convertBigIntToNumber(dailyStatsRaw as any[]),
      userGrowth: convertBigIntToNumber(userGrowthRaw as any[]),
      businessGrowth: convertBigIntToNumber(businessGrowthRaw as any[]),
      topBusinesses: convertBigIntToNumber(topBusinessesRaw as any[]),
    };
  }

  async getAllSubscriptions(
    page: number = 1,
    limit: number = 20,
    filters: { status?: string; planId?: string } = {},
  ): Promise<PaginatedResult<any>> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_PAGE_LIMIT);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.SubscriptionWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.planId) {
      where.planId = filters.planId;
    }

    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          plan: true,
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async cancelSubscription(
    id: string,
    context?: { adminId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<any> {
    const subscription = await this.prisma.subscription.update({
      where: { id },
      data: { status: 'canceled', cancelAtPeriodEnd: true },
    });

    this.logger.log(
      `Admin ${context?.adminId} canceled subscription ${id} [ip=${context?.ipAddress}]`,
    );

    return subscription;
  }

  async extendTrial(
    id: string,
    days: number,
    context?: { adminId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<any> {
    if (days < 1 || days > 90) {
      throw new BadRequestException('Trial extension must be between 1 and 90 days');
    }

    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }
    if (subscription.status !== 'trialing') {
      throw new BadRequestException('Only trialing subscriptions can be extended');
    }

    const newEnd = new Date(subscription.currentPeriodEnd);
    newEnd.setDate(newEnd.getDate() + days);

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { currentPeriodEnd: newEnd },
    });

    this.logger.log(
      `Admin ${context?.adminId} extended trial for subscription ${id} by ${days} days [ip=${context?.ipAddress}]`,
    );

    return updated;
  }

  async getActivityFeed(
    limit: number = 20,
    since?: string,
  ): Promise<any[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    const where: Prisma.AuditLogWhereInput = {};

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.createdAt = { gt: sinceDate };
      }
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        restaurant: {
          select: { id: true, name: true },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      description: this.formatActivityDescription(log),
      userName: log.user?.name || log.user?.email || 'System',
      userEmail: log.user?.email || null,
      userImage: log.user?.image || null,
      businessName: log.restaurant?.name || null,
      timestamp: log.createdAt,
      details: log.details,
    }));
  }

  private formatActivityDescription(log: any): string {
    const userName = log.user?.name || log.user?.email || 'System';
    const businessName = log.restaurant?.name || '';

    const descriptions: Record<string, (d: any) => string> = {
      'business.create': (d) =>
        `${userName} created business "${d?.businessName || businessName}"`,
      'business.update': () =>
        `${userName} updated business "${businessName}"`,
      'business.status_update': (d) =>
        `${userName} changed status of "${businessName}" to ${d?.newStatus || d?.status || 'unknown'}`,
      'order.create': (d) =>
        `${userName} created order ${d?.orderNumber || ''} at "${businessName}"`,
      'order.update': (d) =>
        `${userName} updated order ${d?.orderNumber || ''}`,
      'order.cancel': (d) =>
        `${userName} cancelled order ${d?.orderNumber || ''}`,
      'payment.create': () =>
        `${userName} processed payment at "${businessName}"`,
      'payment.refund': () =>
        `${userName} issued refund at "${businessName}"`,
      'payment.split': () =>
        `${userName} split payment at "${businessName}"`,
      'team.invite': () =>
        `${userName} invited team member to "${businessName}"`,
      'team.remove': () =>
        `${userName} removed team member from "${businessName}"`,
      'team.update_role': () =>
        `${userName} updated a team member's role at "${businessName}"`,
      'menu.create': () =>
        `${userName} added menu item at "${businessName}"`,
      'menu.update': () =>
        `${userName} updated menu at "${businessName}"`,
      'inventory.create': () =>
        `${userName} added inventory item at "${businessName}"`,
      'inventory.adjust': () =>
        `${userName} adjusted stock at "${businessName}"`,
      'expense.create': () =>
        `${userName} logged expense at "${businessName}"`,
      'expense.approve': () =>
        `${userName} approved expense at "${businessName}"`,
      'table.create': () =>
        `${userName} added table at "${businessName}"`,
      'subscription.cancel': () =>
        `${userName} cancelled subscription`,
      'subscription.extend_trial': (d) =>
        `${userName} extended trial by ${d?.days || '?'} days`,
      'admin.ban_user': (d) =>
        `Admin banned user ${d?.targetEmail || ''}`,
      'admin.unban_user': (d) =>
        `Admin unbanned user ${d?.targetEmail || ''}`,
      'admin.update_role': (d) =>
        `Admin changed role for ${d?.targetEmail || ''} to ${d?.newRole || ''}`,
    };

    const formatter = descriptions[log.action];
    if (formatter) {
      try {
        return formatter(log.details);
      } catch {
        // fall through to default
      }
    }
    return `${userName} performed ${log.action} on ${log.resource}`;
  }

  async getWebhookEvents(
    page: number = 1,
    limit: number = 50,
    filters: WebhookEventFilters = {},
  ): Promise<PaginatedResult<any>> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_PAGE_LIMIT);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.WebhookEventWhereInput = {};

    if (filters.provider) {
      where.provider = filters.provider;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.eventType) {
      where.eventType = { contains: filters.eventType, mode: 'insensitive' };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as any).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as any).lte = filters.endDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          provider: true,
          eventType: true,
          eventId: true,
          status: true,
          retryCount: true,
          processedAt: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getWebhookEventDetail(id: string): Promise<any> {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id },
    });

    if (!event) {
      return null;
    }

    return event;
  }

  async retryWebhookEvent(id: string): Promise<any> {
    const event = await this.prisma.webhookEvent.findUnique({ where: { id } });

    if (!event) {
      throw new BadRequestException('Webhook event not found');
    }

    if (event.status !== 'failed') {
      throw new BadRequestException('Only failed webhook events can be retried');
    }

    const updated = await this.prisma.webhookEvent.update({
      where: { id },
      data: {
        status: 'pending',
        retryCount: { increment: 1 },
        errorMessage: null,
      },
    });

    this.logger.log(`Webhook event ${id} marked for retry (attempt ${updated.retryCount})`);

    return updated;
  }

  // ==================== BULK ACTIONS ====================

  async bulkUserAction(
    dto: BulkUserActionDto,
    context?: { adminId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const userId of dto.ids) {
        try {
          if (dto.action === BulkUserAction.BAN) {
            await tx.user.update({
              where: { id: userId },
              data: { banned: true, banReason: dto.reason || null },
            });
          } else {
            await tx.user.update({
              where: { id: userId },
              data: { banned: false, banReason: null },
            });
          }
          processed++;
        } catch (error) {
          failed++;
          this.logger.warn(`Bulk user action failed for user ${userId}: ${error}`);
        }
      }
    });

    this.logger.log(
      `Admin ${context?.adminId} performed bulk ${dto.action} on ${processed} users (${failed} failed) [ip=${context?.ipAddress}]`,
    );

    return { processed, failed };
  }

  async bulkBusinessAction(
    dto: BulkBusinessActionDto,
    context?: { adminId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    const status = dto.action === BulkBusinessAction.SUSPEND ? 'suspended' : 'active';

    await this.prisma.$transaction(async (tx) => {
      for (const businessId of dto.ids) {
        try {
          await tx.restaurant.update({
            where: { id: businessId },
            data: { status },
          });
          processed++;
        } catch (error) {
          failed++;
          this.logger.warn(`Bulk business action failed for business ${businessId}: ${error}`);
        }
      }
    });

    this.logger.log(
      `Admin ${context?.adminId} performed bulk ${dto.action} on ${processed} businesses (${failed} failed) [ip=${context?.ipAddress}]`,
    );

    return { processed, failed };
  }

  async bulkSubscriptionAction(
    dto: BulkSubscriptionActionDto,
    context?: { adminId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const subscriptionId of dto.ids) {
        try {
          if (dto.action === BulkSubscriptionAction.CANCEL) {
            await tx.subscription.update({
              where: { id: subscriptionId },
              data: { status: 'canceled', cancelAtPeriodEnd: true },
            });
          }
          processed++;
        } catch (error) {
          failed++;
          this.logger.warn(`Bulk subscription action failed for subscription ${subscriptionId}: ${error}`);
        }
      }
    });

    this.logger.log(
      `Admin ${context?.adminId} performed bulk ${dto.action} on ${processed} subscriptions (${failed} failed) [ip=${context?.ipAddress}]`,
    );

    return { processed, failed };
  }

  // ==================== PLAN MANAGEMENT ====================

  async getAllPlans(): Promise<any[]> {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });
  }

  async getPlanDetail(id: string): Promise<any> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    // Get active subscriber count and total revenue from active subscriptions
    const [activeSubscribers, revenueAggregate] = await Promise.all([
      this.prisma.subscription.count({
        where: { planId: id, status: 'active' },
      }),
      this.prisma.subscription.count({
        where: { planId: id },
      }),
    ]);

    return {
      ...plan,
      activeSubscribers,
      totalSubscribers: revenueAggregate,
    };
  }

  async createPlan(dto: CreatePlanDto): Promise<any> {
    // Validate unique name
    const existingName = await this.prisma.subscriptionPlan.findUnique({
      where: { name: dto.name },
    });
    if (existingName) {
      throw new BadRequestException(`A plan with name "${dto.name}" already exists`);
    }

    // Validate unique slug
    const existingSlug = await this.prisma.subscriptionPlan.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new BadRequestException(`A plan with slug "${dto.slug}" already exists`);
    }

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        displayName: dto.displayName,
        description: dto.description || null,
        priceMonthly: dto.priceMonthly,
        priceYearly: dto.priceYearly ?? null,
        currency: dto.currency || 'INR',
        maxLocations: dto.maxLocations,
        maxTeamMembers: dto.maxTeamMembers,
        maxOrdersPerMonth: dto.maxOrdersPerMonth,
        features: dto.features,
        dodoProductId: dto.dodoProductId || null,
        isPublic: dto.isPublic ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    this.logger.log(`Plan "${plan.name}" (${plan.id}) created`);

    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<any> {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    // Cannot change slug if plan has active subscribers
    if (dto.slug && dto.slug !== existing.slug) {
      const activeSubscribers = await this.prisma.subscription.count({
        where: { planId: id, status: 'active' },
      });
      if (activeSubscribers > 0) {
        throw new BadRequestException(
          'Cannot change slug for a plan with active subscribers',
        );
      }
    }

    // Validate unique name if changed
    if (dto.name && dto.name !== existing.name) {
      const existingName = await this.prisma.subscriptionPlan.findUnique({
        where: { name: dto.name },
      });
      if (existingName) {
        throw new BadRequestException(`A plan with name "${dto.name}" already exists`);
      }
    }

    // Validate unique slug if changed
    if (dto.slug && dto.slug !== existing.slug) {
      const existingSlug = await this.prisma.subscriptionPlan.findUnique({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        throw new BadRequestException(`A plan with slug "${dto.slug}" already exists`);
      }
    }

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priceMonthly !== undefined && { priceMonthly: dto.priceMonthly }),
        ...(dto.priceYearly !== undefined && { priceYearly: dto.priceYearly }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.maxLocations !== undefined && { maxLocations: dto.maxLocations }),
        ...(dto.maxTeamMembers !== undefined && { maxTeamMembers: dto.maxTeamMembers }),
        ...(dto.maxOrdersPerMonth !== undefined && { maxOrdersPerMonth: dto.maxOrdersPerMonth }),
        ...(dto.features !== undefined && { features: dto.features }),
        ...(dto.dodoProductId !== undefined && { dodoProductId: dto.dodoProductId }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    this.logger.log(`Plan "${plan.name}" (${plan.id}) updated`);

    return plan;
  }

  async archivePlan(id: string): Promise<any> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    const newStatus = plan.status === 'active' ? 'archived' : 'active';

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { status: newStatus },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    this.logger.log(`Plan "${updated.name}" (${updated.id}) status changed to ${newStatus}`);

    return updated;
  }

  // ==================== IMPERSONATION ====================

  async startImpersonation(
    adminUserId: string,
    adminSessionId: string,
    targetUserId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ sessionToken: string; targetUser: { id: string; name: string | null; email: string } }> {
    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Cannot impersonate super admins
    if (targetUser.role === 'super_admin') {
      throw new ForbiddenException('Cannot impersonate a super admin');
    }

    // Check if admin already has an active impersonation session
    const existingImpersonation = await this.prisma.impersonationSession.findUnique({
      where: { adminSessionId },
    });

    if (existingImpersonation) {
      throw new BadRequestException('You already have an active impersonation session. Stop it first.');
    }

    // Generate a new session token and session ID for the impersonated session
    const impSessionToken = randomUUID();
    const impSessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.$transaction(async (tx) => {
      // Create a session for the target user in Better Auth's session table
      await tx.session.create({
        data: {
          id: impSessionId,
          token: impSessionToken,
          userId: targetUserId,
          expiresAt,
          ipAddress: context?.ipAddress || null,
          userAgent: context?.userAgent || null,
        },
      });

      // Create the ImpersonationSession record linking admin and impersonated sessions
      await tx.impersonationSession.create({
        data: {
          adminUserId,
          targetUserId,
          adminSessionId,
          impSessionId,
          expiresAt,
        },
      });
    });

    this.logger.log(
      `Admin ${adminUserId} started impersonation of user ${targetUserId} (${targetUser.email}) [ip=${context?.ipAddress}]`,
    );

    return {
      sessionToken: impSessionToken,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    };
  }

  async stopImpersonation(
    adminSessionToken: string,
  ): Promise<{ success: boolean }> {
    // Find the admin's session by token
    const adminSession = await this.prisma.session.findUnique({
      where: { token: adminSessionToken },
    });

    if (!adminSession) {
      throw new BadRequestException('Admin session not found or expired');
    }

    // Find the impersonation session by admin session ID
    const impersonation = await this.prisma.impersonationSession.findUnique({
      where: { adminSessionId: adminSession.id },
    });

    if (!impersonation) {
      throw new BadRequestException('No active impersonation session found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete the impersonated session from Better Auth's session table
      await tx.session.deleteMany({
        where: { id: impersonation.impSessionId },
      });

      // Delete the ImpersonationSession record
      await tx.impersonationSession.delete({
        where: { id: impersonation.id },
      });
    });

    this.logger.log(
      `Admin ${impersonation.adminUserId} stopped impersonation of user ${impersonation.targetUserId}`,
    );

    return { success: true };
  }
}
