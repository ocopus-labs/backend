import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
      subscriptions,
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
      // Subscriptions with plan info
      this.prisma.subscription.findMany({
        include: { plan: { select: { name: true } } },
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
    const subscriptionStats = {
      total: subscriptions.length,
      active: subscriptions.filter(s => s.status === 'active').length,
      canceled: subscriptions.filter(s => s.status === 'canceled').length,
      byPlan: {} as Record<string, number>,
    };
    for (const sub of subscriptions) {
      const planName = sub.plan.name;
      subscriptionStats.byPlan[planName] = (subscriptionStats.byPlan[planName] || 0) + 1;
    }

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

  async listAllBusinesses(
    page: number = 1,
    limit: number = 20,
    filters: BusinessListFilters = {},
  ): Promise<PaginatedResult<any>> {
    const skip = (page - 1) * limit;

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
      orderBy[filters.sortBy as keyof Prisma.RestaurantOrderByWithRelationInput] =
        filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
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
      limit,
      totalPages: Math.ceil(total / limit),
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

  async updateBusinessStatus(id: string, status: string): Promise<any> {
    return this.prisma.restaurant.update({
      where: { id },
      data: { status },
    });
  }

  async listAllUsers(
    page: number = 1,
    limit: number = 20,
    filters: UserListFilters = {},
  ): Promise<PaginatedResult<any>> {
    const skip = (page - 1) * limit;

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
      orderBy[filters.sortBy as keyof Prisma.UserOrderByWithRelationInput] =
        filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
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
      limit,
      totalPages: Math.ceil(total / limit),
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

  async updateUserGlobalRole(userId: string, role: string): Promise<any> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async getAuditLogs(
    page: number = 1,
    limit: number = 50,
    filters: { userId?: string; resource?: string; action?: string } = {},
  ): Promise<PaginatedResult<any>> {
    const skip = (page - 1) * limit;

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

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
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
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPlatformAnalytics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
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
    const skip = (page - 1) * limit;

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
        take: limit,
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
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
