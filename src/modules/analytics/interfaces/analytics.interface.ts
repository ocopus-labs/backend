import { AnalyticsDaily as PrismaAnalyticsDaily } from '@prisma/client';

export type AnalyticsDaily = PrismaAnalyticsDaily;

export interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalTax: number;
  totalDiscount: number;
  netRevenue: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface TopSellingItem {
  itemId: string;
  itemName: string;
  category: string;
  quantitySold: number;
  revenue: number;
}

export interface HourlyBreakdown {
  hour: number;
  orders: number;
  revenue: number;
}

export interface StaffPerformance {
  staffId: string;
  staffName: string;
  ordersProcessed: number;
  revenue: number;
  averageOrderValue: number;
}

export interface TablePerformance {
  tableId: string;
  tableNumber: string;
  ordersServed: number;
  revenue: number;
  averageTurnoverTime: number;
}

export interface CustomerInsights {
  newCustomers: number;
  returningCustomers: number;
  averagePartySize: number;
  peakHours: number[];
}

export interface DashboardStats {
  today: {
    revenue: number;
    orders: number;
    averageOrderValue: number;
    topPaymentMethod: string;
  };
  comparison: {
    revenueChange: number;
    ordersChange: number;
    aovChange: number;
  };
  recentOrders: number;
  pendingOrders: number;
  activeTableCount: number;
  lowStockItems: number;
}

export interface DateRangeReport {
  startDate: Date;
  endDate: Date;
  salesSummary: SalesSummary;
  paymentMethods: PaymentMethodBreakdown[];
  topItems: TopSellingItem[];
  dailyTrend: { date: string; revenue: number; orders: number }[];
  staffPerformance: StaffPerformance[];
}

export type ReportPeriod =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

export const REPORT_PERIODS: Record<string, ReportPeriod> = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  CUSTOM: 'custom',
};
