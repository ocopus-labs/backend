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

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get dashboard statistics for quick overview
   */
  async getDashboardStats(restaurantId: string): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's orders
    const todayOrders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: today },
        status: { not: 'cancelled' },
      },
      include: {
        payments: true,
      },
    });

    // Yesterday's orders for comparison
    const yesterdayOrders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: yesterday, lt: today },
        status: { not: 'cancelled' },
      },
    });

    // Calculate today's stats
    const todayRevenue = todayOrders.reduce((sum, order) => {
      const pricing = order.pricing as { total?: number };
      return sum + (pricing?.total || 0);
    }, 0);

    const yesterdayRevenue = yesterdayOrders.reduce((sum, order) => {
      const pricing = order.pricing as { total?: number };
      return sum + (pricing?.total || 0);
    }, 0);

    const todayOrderCount = todayOrders.length;
    const yesterdayOrderCount = yesterdayOrders.length;

    const todayAOV = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;
    const yesterdayAOV = yesterdayOrderCount > 0 ? yesterdayRevenue / yesterdayOrderCount : 0;

    // Payment method breakdown for today
    const paymentMethods: Record<string, number> = {};
    for (const order of todayOrders) {
      for (const payment of order.payments) {
        paymentMethods[payment.method] = (paymentMethods[payment.method] || 0) + 1;
      }
    }

    const topPaymentMethod = Object.entries(paymentMethods)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'cash';

    // Pending orders
    const pendingOrders = await this.prisma.order.count({
      where: {
        restaurantId,
        status: 'active',
        paymentStatus: { in: ['pending', 'partial'] },
      },
    });

    // Active tables
    const activeTables = await this.prisma.table.count({
      where: {
        restaurantId,
        status: 'occupied',
      },
    });

    // Low stock items
    const lowStockItems = await this.prisma.inventoryItem.count({
      where: {
        restaurantId,
        isActive: true,
        status: { in: ['low_stock', 'out_of_stock'] },
      },
    });

    // Calculate percentage changes
    const revenueChange = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : 0;

    const ordersChange = yesterdayOrderCount > 0
      ? ((todayOrderCount - yesterdayOrderCount) / yesterdayOrderCount) * 100
      : 0;

    const aovChange = yesterdayAOV > 0
      ? ((todayAOV - yesterdayAOV) / yesterdayAOV) * 100
      : 0;

    return {
      today: {
        revenue: todayRevenue,
        orders: todayOrderCount,
        averageOrderValue: todayAOV,
        topPaymentMethod,
      },
      comparison: {
        revenueChange: Math.round(revenueChange * 100) / 100,
        ordersChange: Math.round(ordersChange * 100) / 100,
        aovChange: Math.round(aovChange * 100) / 100,
      },
      recentOrders: todayOrderCount,
      pendingOrders,
      activeTableCount: activeTables,
      lowStockItems,
    };
  }

  /**
   * Get sales summary for a date range
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
    });

    let totalRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const order of orders) {
      const pricing = order.pricing as {
        total?: number;
        tax?: number;
        discount?: number;
        subtotal?: number;
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
   */
  async getPaymentMethodBreakdown(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentMethodBreakdown[]> {
    const payments = await this.prisma.payment.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startDate, lte: endDate },
        status: 'completed',
      },
    });

    const methodMap = new Map<string, { count: number; amount: number }>();

    for (const payment of payments) {
      const current = methodMap.get(payment.method) || { count: 0, amount: 0 };
      methodMap.set(payment.method, {
        count: current.count + 1,
        amount: current.amount + Number(payment.amount),
      });
    }

    const totalAmount = Array.from(methodMap.values()).reduce(
      (sum, { amount }) => sum + amount,
      0,
    );

    return Array.from(methodMap.entries())
      .map(([method, { count, amount }]) => ({
        method,
        count,
        amount: Math.round(amount * 100) / 100,
        percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Get top selling items
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

    // Get daily trend
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'cancelled' },
      },
      orderBy: { createdAt: 'asc' },
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

    const [salesSummary, paymentMethods, topItems, hourlyBreakdown, staffPerformance] =
      await Promise.all([
        this.getSalesSummary(restaurantId, startOfDay, endOfDay),
        this.getPaymentMethodBreakdown(restaurantId, startOfDay, endOfDay),
        this.getTopSellingItems(restaurantId, startOfDay, endOfDay, 20),
        this.getHourlyBreakdown(restaurantId, date),
        this.getStaffPerformance(restaurantId, startOfDay, endOfDay),
      ]);

    // Get table performance
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { not: 'cancelled' },
        tableId: { not: null },
      },
      include: { table: true },
    });

    const tableMap = new Map<string, { orders: number; revenue: number; tableNumber: string }>();
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

    const tablePerformance = Array.from(tableMap.entries()).map(([tableId, data]) => ({
      tableId,
      tableNumber: data.tableNumber,
      ordersServed: data.orders,
      revenue: Math.round(data.revenue * 100) / 100,
      averageTurnoverTime: 0,
    }));

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
  getDateRangeFromPeriod(period: ReportPeriod): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    let startDate = new Date(now);
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
