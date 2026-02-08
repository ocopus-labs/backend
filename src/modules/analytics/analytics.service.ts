import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  AnalyticsDaily,
  SalesSummary,
  PaymentMethodBreakdown,
  TopSellingItem,
  HourlyBreakdown,
  StaffPerformance,
  DashboardStats,
  DateRangeReport,
  ReportPeriod,
  CustomerInsights,
} from './interfaces';

/** Max rows to load for in-memory aggregation of order items (JSON column). */
const MAX_ANALYTICS_ROWS = 10_000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get dashboard statistics for quick overview
   * Optimized: uses count/aggregate instead of loading full objects
   */
  async getDashboardStats(restaurantId: string): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const baseWhere = {
      restaurantId,
      status: { not: 'cancelled' } as const,
    };

    // Parallel: aggregate today + yesterday + counts (no full object loads)
    const [
      todayAgg,
      todayCount,
      yesterdayAgg,
      yesterdayCount,
      paymentMethodCounts,
      pendingOrders,
      activeTables,
      lowStockItems,
    ] = await Promise.all([
      // Today's revenue via select + limited fields
      this.prisma.order.findMany({
        where: { ...baseWhere, createdAt: { gte: today } },
        select: { pricing: true },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, createdAt: { gte: today } },
      }),
      // Yesterday's revenue
      this.prisma.order.findMany({
        where: { ...baseWhere, createdAt: { gte: yesterday, lt: today } },
        select: { pricing: true },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, createdAt: { gte: yesterday, lt: today } },
      }),
      // Payment method counts via groupBy (no N+1)
      this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          restaurantId,
          createdAt: { gte: today },
          status: 'completed',
        },
        _count: { method: true },
        orderBy: { _count: { method: 'desc' } },
        take: 1,
      }),
      this.prisma.order.count({
        where: {
          restaurantId,
          status: 'active',
          paymentStatus: { in: ['pending', 'partial'] },
        },
      }),
      this.prisma.table.count({
        where: { restaurantId, status: 'occupied' },
      }),
      this.prisma.inventoryItem.count({
        where: {
          restaurantId,
          isActive: true,
          status: { in: ['low_stock', 'out_of_stock'] },
        },
      }),
    ]);

    const todayRevenue = todayAgg.reduce((sum, o) => {
      const pricing = o.pricing as { total?: number };
      return sum + (pricing?.total || 0);
    }, 0);

    const yesterdayRevenue = yesterdayAgg.reduce((sum, o) => {
      const pricing = o.pricing as { total?: number };
      return sum + (pricing?.total || 0);
    }, 0);

    const todayAOV = todayCount > 0 ? todayRevenue / todayCount : 0;
    const yesterdayAOV =
      yesterdayCount > 0 ? yesterdayRevenue / yesterdayCount : 0;

    const topPaymentMethod = paymentMethodCounts[0]?.method || 'cash';

    const revenueChange =
      yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : 0;
    const ordersChange =
      yesterdayCount > 0
        ? ((todayCount - yesterdayCount) / yesterdayCount) * 100
        : 0;
    const aovChange =
      yesterdayAOV > 0 ? ((todayAOV - yesterdayAOV) / yesterdayAOV) * 100 : 0;

    return {
      today: {
        revenue: todayRevenue,
        orders: todayCount,
        averageOrderValue: todayAOV,
        topPaymentMethod,
      },
      comparison: {
        revenueChange: Math.round(revenueChange * 100) / 100,
        ordersChange: Math.round(ordersChange * 100) / 100,
        aovChange: Math.round(aovChange * 100) / 100,
      },
      recentOrders: todayCount,
      pendingOrders,
      activeTableCount: activeTables,
      lowStockItems,
    };
  }

  /**
   * Get sales summary for a date range
   * Optimized: select only pricing column
   */
  async getSalesSummary(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesSummary> {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'cancelled' },
      },
      select: { pricing: true },
      take: MAX_ANALYTICS_ROWS,
    });

    let totalRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const order of orders) {
      const pricing = order.pricing as {
        total?: number;
        tax?: number;
        discount?: number;
      };
      totalRevenue += pricing?.total || 0;
      totalTax += pricing?.tax || 0;
      totalDiscount += pricing?.discount || 0;
    }

    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const netRevenue = totalRevenue - totalTax;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
    };
  }

  /**
   * Get payment method breakdown
   * Optimized: use groupBy aggregation instead of loading all payment rows
   */
  async getPaymentMethodBreakdown(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentMethodBreakdown[]> {
    const grouped = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        restaurantId,
        createdAt: { gte: startDate, lte: endDate },
        status: 'completed',
      },
      _count: { method: true },
      _sum: { amount: true },
    });

    const totalAmount = grouped.reduce(
      (sum, g) => sum + Number(g._sum.amount || 0),
      0,
    );

    return grouped
      .map((g) => {
        const amount = Number(g._sum.amount || 0);
        return {
          method: g.method,
          count: g._count.method,
          amount: Math.round(amount * 100) / 100,
          percentage:
            totalAmount > 0
              ? Math.round((amount / totalAmount) * 10000) / 100
              : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Get top selling items
   * Optimized: select only items column, apply take limit
   */
  async getTopSellingItems(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<TopSellingItem[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'cancelled' },
      },
      select: { items: true },
      take: MAX_ANALYTICS_ROWS,
    });

    const itemMap = new Map<string, TopSellingItem>();

    for (const order of orders) {
      const items = order.items as Array<{
        id?: string;
        name?: string;
        category?: string;
        quantity?: number;
        price?: number;
      }>;

      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const itemId = item.id || item.name || 'unknown';
        const current = itemMap.get(itemId) || {
          itemId,
          itemName: item.name || 'Unknown',
          category: item.category || 'Uncategorized',
          quantitySold: 0,
          revenue: 0,
        };

        current.quantitySold += item.quantity || 1;
        current.revenue += (item.price || 0) * (item.quantity || 1);
        itemMap.set(itemId, current);
      }
    }

    return Array.from(itemMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, limit)
      .map((item) => ({
        ...item,
        revenue: Math.round(item.revenue * 100) / 100,
      }));
  }

  /**
   * Get hourly breakdown for a specific date
   * Optimized: select only createdAt + pricing
   */
  async getHourlyBreakdown(
    restaurantId: string,
    date: Date,
  ): Promise<HourlyBreakdown[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { not: 'cancelled' },
      },
      select: { createdAt: true, pricing: true },
    });

    const hourlyData = new Array(24).fill(null).map((_, hour) => ({
      hour,
      orders: 0,
      revenue: 0,
    }));

    for (const order of orders) {
      const hour = order.createdAt.getHours();
      const pricing = order.pricing as { total?: number };

      hourlyData[hour].orders++;
      hourlyData[hour].revenue += pricing?.total || 0;
    }

    return hourlyData.map((data) => ({
      ...data,
      revenue: Math.round(data.revenue * 100) / 100,
    }));
  }

  /**
   * Get staff performance
   * Optimized: select only staffId, staffName, pricing
   */
  async getStaffPerformance(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StaffPerformance[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'cancelled' },
      },
      select: { staffId: true, staffName: true, pricing: true },
      take: MAX_ANALYTICS_ROWS,
    });

    const staffMap = new Map<string, StaffPerformance>();

    for (const order of orders) {
      const staffId = order.staffId;
      const staffName = order.staffName;
      const pricing = order.pricing as { total?: number };
      const revenue = pricing?.total || 0;

      const current = staffMap.get(staffId) || {
        staffId,
        staffName,
        ordersProcessed: 0,
        revenue: 0,
        averageOrderValue: 0,
      };

      current.ordersProcessed++;
      current.revenue += revenue;
      staffMap.set(staffId, current);
    }

    return Array.from(staffMap.values())
      .map((staff) => ({
        ...staff,
        revenue: Math.round(staff.revenue * 100) / 100,
        averageOrderValue:
          staff.ordersProcessed > 0
            ? Math.round((staff.revenue / staff.ordersProcessed) * 100) / 100
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Get full date range report
   * Optimized: daily trend uses select + take limit
   */
  async getDateRangeReport(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DateRangeReport> {
    const [salesSummary, paymentMethods, topItems, staffPerformance] =
      await Promise.all([
        this.getSalesSummary(restaurantId, startDate, endDate),
        this.getPaymentMethodBreakdown(restaurantId, startDate, endDate),
        this.getTopSellingItems(restaurantId, startDate, endDate),
        this.getStaffPerformance(restaurantId, startDate, endDate),
      ]);

    // Daily trend: select only needed fields
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'cancelled' },
      },
      select: { createdAt: true, pricing: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_ANALYTICS_ROWS,
    });

    const dailyMap = new Map<string, { revenue: number; orders: number }>();

    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const pricing = order.pricing as { total?: number };
      const current = dailyMap.get(dateKey) || { revenue: 0, orders: 0 };

      current.orders++;
      current.revenue += pricing?.total || 0;
      dailyMap.set(dateKey, current);
    }

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      startDate,
      endDate,
      salesSummary,
      paymentMethods,
      topItems,
      dailyTrend,
      staffPerformance,
    };
  }

  /**
   * Generate and store daily analytics
   */
  async generateDailyAnalytics(
    restaurantId: string,
    date: Date,
  ): Promise<AnalyticsDaily> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if already exists
    const existing = await this.prisma.analyticsDaily.findUnique({
      where: {
        restaurantId_date: { restaurantId, date: startOfDay },
      },
    });

    const [
      salesSummary,
      paymentMethods,
      topItems,
      hourlyBreakdown,
      staffPerformance,
    ] = await Promise.all([
      this.getSalesSummary(restaurantId, startOfDay, endOfDay),
      this.getPaymentMethodBreakdown(restaurantId, startOfDay, endOfDay),
      this.getTopSellingItems(restaurantId, startOfDay, endOfDay, 20),
      this.getHourlyBreakdown(restaurantId, date),
      this.getStaffPerformance(restaurantId, startOfDay, endOfDay),
    ]);

    // Table performance: select only needed fields
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { not: 'cancelled' },
        tableId: { not: null },
      },
      select: {
        tableId: true,
        tableNumber: true,
        pricing: true,
        table: { select: { tableNumber: true } },
      },
    });

    const tableMap = new Map<
      string,
      { orders: number; revenue: number; tableNumber: string }
    >();
    for (const order of orders) {
      if (!order.tableId) continue;
      const pricing = order.pricing as { total?: number };
      const current = tableMap.get(order.tableId) || {
        orders: 0,
        revenue: 0,
        tableNumber: order.table?.tableNumber || order.tableNumber || '',
      };
      current.orders++;
      current.revenue += pricing?.total || 0;
      tableMap.set(order.tableId, current);
    }

    const tablePerformance = Array.from(tableMap.entries()).map(
      ([tableId, data]) => ({
        tableId,
        tableNumber: data.tableNumber,
        ordersServed: data.orders,
        revenue: Math.round(data.revenue * 100) / 100,
        averageTurnoverTime: 0,
      }),
    );

    // Customer insights
    const peakHours = hourlyBreakdown
      .filter((h) => h.orders > 0)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 3)
      .map((h) => h.hour);

    const customerInsights = {
      newCustomers: 0,
      returningCustomers: 0,
      averagePartySize: 0,
      peakHours,
    };

    const analyticsData = {
      date: startOfDay,
      salesSummary: { ...salesSummary },
      paymentMethods: paymentMethods.map((p) => ({ ...p })),
      topItems: topItems.map((t) => ({ ...t })),
      hourlyBreakdown: hourlyBreakdown.map((h) => ({ ...h })),
      staffPerformance: staffPerformance.map((s) => ({ ...s })),
      tablePerformance: tablePerformance.map((t) => ({ ...t })),
      customerInsights,
      inventoryConsumed: [],
    };

    if (existing) {
      return this.prisma.analyticsDaily.update({
        where: { id: existing.id },
        data: analyticsData,
      });
    }

    return this.prisma.analyticsDaily.create({
      data: {
        ...analyticsData,
        restaurant: { connect: { id: restaurantId } },
      },
    });
  }

  /**
   * Get stored daily analytics
   */
  async getDailyAnalytics(
    restaurantId: string,
    date: Date,
  ): Promise<AnalyticsDaily | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.analyticsDaily.findUnique({
      where: {
        restaurantId_date: { restaurantId, date: startOfDay },
      },
    });
  }

  /**
   * Helper to get date range from period
   */
  getDateRangeFromPeriod(period: ReportPeriod): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    switch (period) {
      case 'today':
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }
}
