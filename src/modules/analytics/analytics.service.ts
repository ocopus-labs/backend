import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';
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

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get dashboard statistics for quick overview
   * Uses raw SQL aggregation instead of loading full order rows
   */
  async getDashboardStats(restaurantId: string): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayStats,
      yesterdayStats,
      paymentMethodCounts,
      pendingOrders,
      activeTables,
      lowStockItems,
    ] = await Promise.all([
      // Today's revenue + count via raw SQL
      this.prisma.$queryRaw<
        [{ order_count: bigint; total_revenue: Prisma.Decimal }]
      >`
        SELECT
          COUNT(*) as order_count,
          COALESCE(SUM((pricing->>'total')::numeric), 0) as total_revenue
        FROM orders
        WHERE restaurant_id = ${restaurantId}
          AND status != 'cancelled'
          AND created_at >= ${today} AND created_at < ${tomorrow}
      `,
      // Yesterday's revenue + count via raw SQL
      this.prisma.$queryRaw<
        [{ order_count: bigint; total_revenue: Prisma.Decimal }]
      >`
        SELECT
          COUNT(*) as order_count,
          COALESCE(SUM((pricing->>'total')::numeric), 0) as total_revenue
        FROM orders
        WHERE restaurant_id = ${restaurantId}
          AND status != 'cancelled'
          AND created_at >= ${yesterday} AND created_at < ${today}
      `,
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

    const todayCount = Number(todayStats[0]?.order_count ?? 0);
    const todayRevenue = Number(todayStats[0]?.total_revenue ?? 0);
    const yesterdayCount = Number(yesterdayStats[0]?.order_count ?? 0);
    const yesterdayRevenue = Number(yesterdayStats[0]?.total_revenue ?? 0);

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
   * Uses raw SQL aggregation instead of loading order rows
   */
  async getSalesSummary(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesSummary> {
    const result = await this.prisma.$queryRaw<
      [{ total_orders: bigint; total_revenue: Prisma.Decimal; total_tax: Prisma.Decimal; total_discount: Prisma.Decimal }]
    >`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM((pricing->>'total')::numeric), 0) as total_revenue,
        COALESCE(SUM((pricing->>'taxAmount')::numeric), 0) as total_tax,
        COALESCE(SUM((pricing->>'discountAmount')::numeric), 0) as total_discount
      FROM orders
      WHERE restaurant_id = ${restaurantId}
        AND created_at >= ${startDate} AND created_at <= ${endDate}
        AND status != 'cancelled'
    `;

    const totalOrders = Number(result[0]?.total_orders ?? 0);
    const totalRevenue = Number(result[0]?.total_revenue ?? 0);
    const totalTax = Number(result[0]?.total_tax ?? 0);
    const totalDiscount = Number(result[0]?.total_discount ?? 0);
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
   * Uses raw SQL with jsonb_array_elements for DB-level aggregation
   */
  async getTopSellingItems(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<TopSellingItem[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        item_id: string;
        item_name: string;
        category: string;
        quantity_sold: Prisma.Decimal;
        revenue: Prisma.Decimal;
      }>
    >`
      SELECT
        COALESCE(item->>'menuItemId', item->>'id', item->>'name', 'unknown') as item_id,
        COALESCE(item->>'name', 'Unknown') as item_name,
        COALESCE(item->>'category', 'Uncategorized') as category,
        SUM(COALESCE((item->>'quantity')::int, 1)) as quantity_sold,
        SUM(COALESCE((item->>'totalPrice')::numeric, COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::int, 1))) as revenue
      FROM orders, jsonb_array_elements(items) as item
      WHERE restaurant_id = ${restaurantId}
        AND created_at >= ${startDate} AND created_at <= ${endDate}
        AND status != 'cancelled'
      GROUP BY item->>'menuItemId', item->>'id', item->>'name', item->>'category'
      ORDER BY quantity_sold DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      itemId: row.item_id,
      itemName: row.item_name,
      category: row.category,
      quantitySold: Number(row.quantity_sold),
      revenue: Math.round(Number(row.revenue) * 100) / 100,
    }));
  }

  /**
   * Get hourly breakdown for a specific date
   * Uses raw SQL GROUP BY EXTRACT(HOUR)
   */
  async getHourlyBreakdown(
    restaurantId: string,
    date: Date,
  ): Promise<HourlyBreakdown[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const rows = await this.prisma.$queryRaw<
      Array<{ hour: number; orders: bigint; revenue: Prisma.Decimal }>
    >`
      SELECT
        EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*) as orders,
        COALESCE(SUM((pricing->>'total')::numeric), 0) as revenue
      FROM orders
      WHERE restaurant_id = ${restaurantId}
        AND created_at >= ${startOfDay} AND created_at <= ${endOfDay}
        AND status != 'cancelled'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `;

    // Fill all 24 hours, merging SQL results
    const hourMap = new Map(rows.map((r) => [r.hour, r]));
    return Array.from({ length: 24 }, (_, hour) => {
      const row = hourMap.get(hour);
      return {
        hour,
        orders: row ? Number(row.orders) : 0,
        revenue: row ? Math.round(Number(row.revenue) * 100) / 100 : 0,
      };
    });
  }

  /**
   * Get staff performance
   * Uses raw SQL GROUP BY staff_id, staff_name
   */
  async getStaffPerformance(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StaffPerformance[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        staff_id: string;
        staff_name: string;
        orders_processed: bigint;
        revenue: Prisma.Decimal;
      }>
    >`
      SELECT
        staff_id,
        staff_name,
        COUNT(*) as orders_processed,
        COALESCE(SUM((pricing->>'total')::numeric), 0) as revenue
      FROM orders
      WHERE restaurant_id = ${restaurantId}
        AND created_at >= ${startDate} AND created_at <= ${endDate}
        AND status != 'cancelled'
        AND staff_id IS NOT NULL
      GROUP BY staff_id, staff_name
      ORDER BY revenue DESC
    `;

    return rows.map((row) => {
      const ordersProcessed = Number(row.orders_processed);
      const revenue = Math.round(Number(row.revenue) * 100) / 100;
      return {
        staffId: row.staff_id,
        staffName: row.staff_name,
        ordersProcessed,
        revenue,
        averageOrderValue:
          ordersProcessed > 0
            ? Math.round((revenue / ordersProcessed) * 100) / 100
            : 0,
      };
    });
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

    // Daily trend via raw SQL aggregation
    const dailyTrendRows = await this.prisma.$queryRaw<
      Array<{ date: string; revenue: Prisma.Decimal; orders: bigint }>
    >`
      SELECT
        DATE(created_at)::text as date,
        COALESCE(SUM((pricing->>'total')::numeric), 0) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE restaurant_id = ${restaurantId}
        AND created_at >= ${startDate} AND created_at <= ${endDate}
        AND status != 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    const dailyTrend = dailyTrendRows.map((row) => ({
      date: row.date,
      revenue: Math.round(Number(row.revenue) * 100) / 100,
      orders: Number(row.orders),
    }));

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
