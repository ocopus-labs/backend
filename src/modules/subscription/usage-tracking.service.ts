import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LimitCheckResult, UsageStats } from './interfaces';

@Injectable()
export class UsageTrackingService {
  private readonly logger = new Logger(UsageTrackingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get the current billing period start and end dates
   */
  private getCurrentPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }

  /**
   * Get or create usage record for current period
   */
  async getOrCreateUsageRecord(subscriptionId: string, restaurantId: string) {
    const { start, end } = this.getCurrentPeriod();

    let usageRecord = await this.prisma.usageRecord.findFirst({
      where: {
        subscriptionId,
        restaurantId,
        periodStart: start,
      },
    });

    if (!usageRecord) {
      usageRecord = await this.prisma.usageRecord.create({
        data: {
          subscriptionId,
          restaurantId,
          periodStart: start,
          periodEnd: end,
          ordersCount: 0,
        },
      });
    }

    return usageRecord;
  }

  /**
   * Increment order usage for a restaurant
   */
  async incrementOrderUsage(restaurantId: string): Promise<void> {
    // Get restaurant and owner's subscription
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        owner: {
          include: {
            subscriptions: {
              where: { status: { in: ['active', 'trialing'] } },
              take: 1,
            },
          },
        },
      },
    });

    if (!restaurant?.owner?.subscriptions?.[0]) {
      this.logger.debug(`No active subscription found for restaurant ${restaurantId}`);
      return;
    }

    const subscription = restaurant.owner.subscriptions[0];
    const usageRecord = await this.getOrCreateUsageRecord(
      subscription.id,
      restaurantId,
    );

    await this.prisma.usageRecord.update({
      where: { id: usageRecord.id },
      data: { ordersCount: { increment: 1 } },
    });

    this.logger.debug(
      `Incremented order usage for restaurant ${restaurantId}, new count: ${usageRecord.ordersCount + 1}`,
    );
  }

  /**
   * Check if a restaurant can create more orders this month
   */
  async checkOrderLimit(restaurantId: string): Promise<LimitCheckResult> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        owner: {
          include: {
            subscriptions: {
              where: { status: { in: ['active', 'trialing'] } },
              include: { plan: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!restaurant?.owner?.subscriptions?.[0]) {
      // No subscription = use free plan defaults
      return {
        allowed: true,
        current: 0,
        limit: 100,
        message: 'No subscription found, using free plan limits',
      };
    }

    const subscription = restaurant.owner.subscriptions[0];
    const plan = subscription.plan;

    // Unlimited orders
    if (plan.maxOrdersPerMonth === -1) {
      return { allowed: true, current: 0, limit: -1 };
    }

    const usageRecord = await this.getOrCreateUsageRecord(
      subscription.id,
      restaurantId,
    );

    const allowed = usageRecord.ordersCount < plan.maxOrdersPerMonth;

    return {
      allowed,
      current: usageRecord.ordersCount,
      limit: plan.maxOrdersPerMonth,
      message: allowed
        ? undefined
        : `Monthly order limit reached (${usageRecord.ordersCount}/${plan.maxOrdersPerMonth}). Please upgrade your plan.`,
    };
  }

  /**
   * Check if a user can add more locations
   */
  async checkLocationLimit(userId: string): Promise<LimitCheckResult> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
      include: { plan: true },
    });

    if (!subscription) {
      // No subscription = use free plan defaults
      const currentCount = await this.prisma.restaurant.count({
        where: { ownerId: userId },
      });
      return {
        allowed: currentCount < 1,
        current: currentCount,
        limit: 1,
      };
    }

    const plan = subscription.plan;

    // Unlimited locations
    if (plan.maxLocations === -1) {
      return { allowed: true, current: 0, limit: -1 };
    }

    const currentCount = await this.prisma.restaurant.count({
      where: { ownerId: userId },
    });

    const allowed = currentCount < plan.maxLocations;

    return {
      allowed,
      current: currentCount,
      limit: plan.maxLocations,
      message: allowed
        ? undefined
        : `Location limit reached (${currentCount}/${plan.maxLocations}). Please upgrade your plan.`,
    };
  }

  /**
   * Check if a business can add more team members
   */
  async checkTeamMemberLimit(restaurantId: string): Promise<LimitCheckResult> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        owner: {
          include: {
            subscriptions: {
              where: { status: { in: ['active', 'trialing'] } },
              include: { plan: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!restaurant?.owner?.subscriptions?.[0]) {
      // No subscription = use free plan defaults
      const currentCount = await this.prisma.businessUser.count({
        where: { restaurantId },
      });
      return {
        allowed: currentCount < 2,
        current: currentCount,
        limit: 2,
      };
    }

    const plan = restaurant.owner.subscriptions[0].plan;

    // Unlimited team members
    if (plan.maxTeamMembers === -1) {
      return { allowed: true, current: 0, limit: -1 };
    }

    const currentCount = await this.prisma.businessUser.count({
      where: { restaurantId },
    });

    const allowed = currentCount < plan.maxTeamMembers;

    return {
      allowed,
      current: currentCount,
      limit: plan.maxTeamMembers,
      message: allowed
        ? undefined
        : `Team member limit reached (${currentCount}/${plan.maxTeamMembers}). Please upgrade your plan.`,
    };
  }

  /**
   * Get current usage stats for a user
   */
  async getCurrentUsage(userId: string): Promise<UsageStats> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
      include: { plan: true },
    });

    const { start, end } = this.getCurrentPeriod();

    // Get all restaurants owned by user
    const restaurants = await this.prisma.restaurant.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    // Get total orders this month across all restaurants
    let ordersThisMonth = 0;
    if (subscription) {
      const usageRecords = await this.prisma.usageRecord.findMany({
        where: {
          subscriptionId: subscription.id,
          periodStart: start,
        },
      });
      ordersThisMonth = usageRecords.reduce((sum, r) => sum + r.ordersCount, 0);
    }

    // Get total team members across all restaurants
    const teamMembersCount = await this.prisma.businessUser.count({
      where: {
        restaurantId: { in: restaurants.map((r) => r.id) },
      },
    });

    const plan = subscription?.plan;

    return {
      ordersThisMonth,
      orderLimit: plan?.maxOrdersPerMonth ?? 100,
      locationsCount: restaurants.length,
      locationLimit: plan?.maxLocations ?? 1,
      teamMembersCount,
      teamMemberLimit: plan?.maxTeamMembers ?? 2,
      periodStart: start,
      periodEnd: end,
    };
  }

  /**
   * Reset monthly usage for a subscription
   */
  async resetMonthlyUsage(subscriptionId: string): Promise<void> {
    const { start } = this.getCurrentPeriod();

    await this.prisma.usageRecord.updateMany({
      where: {
        subscriptionId,
        periodStart: start,
      },
      data: { ordersCount: 0 },
    });

    this.logger.log(`Reset monthly usage for subscription ${subscriptionId}`);
  }
}
