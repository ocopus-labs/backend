import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DodoService } from './dodo';
import { PlanService } from './plan.service';
import { UsageTrackingService } from './usage-tracking.service';
import { User, Subscription, SubscriptionPlan } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly appUrl: string;

  constructor(
    private prisma: PrismaService,
    private dodoService: DodoService,
    private planService: PlanService,
    private usageTracking: UsageTrackingService,
    private configService: ConfigService,
  ) {
    this.appUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:5173';
  }

  /**
   * Get active subscription for a user
   */
  async getActiveSubscription(
    userId: string,
  ): Promise<(Subscription & { plan: SubscriptionPlan }) | null> {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing', 'past_due'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get subscription by Dodo subscription ID
   */
  async getByDodoSubscriptionId(dodoSubscriptionId: string) {
    return this.prisma.subscription.findUnique({
      where: { dodoSubscriptionId },
      include: { plan: true, user: true },
    });
  }

  /**
   * Create or get a subscription for a user
   * New users start on free plan
   */
  async ensureSubscription(
    userId: string,
  ): Promise<Subscription & { plan: SubscriptionPlan }> {
    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      return existing;
    }

    // Create free subscription
    const freePlan = await this.planService.getFreePlan();
    const now = new Date();
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
    );

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });

    this.logger.log(`Created free subscription for user ${userId}`);
    return subscription;
  }

  /**
   * Create checkout session for upgrading to a paid plan
   */
  async createCheckoutSession(
    user: User,
    planSlug: string,
    returnUrl?: string,
  ) {
    const plan = await this.planService.getPlanBySlug(planSlug);

    if (!plan.dodoProductId) {
      throw new BadRequestException(
        `Plan '${planSlug}' is not available for purchase`,
      );
    }

    // Get or create subscription to store the dodo customer ID
    const subscription = await this.ensureSubscription(user.id);

    const checkout = await this.dodoService.createCheckoutSession({
      productId: plan.dodoProductId,
      customerEmail: user.email,
      customerName: user.name || user.email.split('@')[0],
      customerId: subscription.dodoCustomerId || undefined,
      returnUrl:
        (returnUrl || `${this.appUrl}/dashboard/subscriptions/result`) +
        '?from=checkout',
      metadata: {
        user_id: user.id,
        plan_slug: planSlug,
      },
    });

    this.logger.log(
      `Created checkout session for user ${user.id}, plan ${planSlug}`,
    );

    return checkout;
  }

  /**
   * Handle subscription activation from webhook
   */
  async activateSubscription(
    dodoSubscriptionId: string,
    dodoCustomerId: string,
    dodoProductId: string,
    metadata: Record<string, string>,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const userId = metadata.user_id;
    if (!userId) {
      throw new BadRequestException('Missing user_id in webhook metadata');
    }

    // Find the plan by Dodo product ID
    const plan = await this.planService.getPlanByDodoProductId(dodoProductId);
    if (!plan) {
      throw new NotFoundException(
        `Plan not found for Dodo product ${dodoProductId}`,
      );
    }

    // Get existing subscription
    const existing = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      // Update existing subscription
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          status: 'active',
          dodoSubscriptionId,
          dodoCustomerId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });

      this.logger.log(
        `Upgraded subscription ${existing.id} to plan ${plan.slug}`,
      );
    } else {
      // Create new subscription
      await this.prisma.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: 'active',
          dodoSubscriptionId,
          dodoCustomerId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });

      this.logger.log(
        `Created new subscription for user ${userId}, plan ${plan.slug}`,
      );
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string, immediate = false) {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    if (subscription.plan.slug === 'free') {
      throw new BadRequestException('Cannot cancel free plan');
    }

    if (subscription.dodoSubscriptionId) {
      await this.dodoService.cancelSubscription(
        subscription.dodoSubscriptionId,
      );
    }

    if (immediate) {
      // Immediate cancellation - downgrade to free
      const freePlan = await this.planService.getFreePlan();
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'canceled',
          canceledAt: new Date(),
          planId: freePlan.id,
        },
      });
    } else {
      // Cancel at period end
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
        },
      });
    }

    this.logger.log(
      `Cancelled subscription for user ${userId}, immediate: ${immediate}`,
    );

    return { success: true, cancelAtPeriodEnd: !immediate };
  }

  /**
   * Handle subscription cancellation from webhook
   */
  async handleCancellation(dodoSubscriptionId: string) {
    const subscription = await this.getByDodoSubscriptionId(dodoSubscriptionId);
    if (!subscription) {
      this.logger.warn(
        `Subscription not found for Dodo ID: ${dodoSubscriptionId}`,
      );
      return;
    }

    // Downgrade to free plan
    const freePlan = await this.planService.getFreePlan();

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        planId: freePlan.id,
        dodoSubscriptionId: null,
      },
    });

    this.logger.log(
      `Subscription ${subscription.id} cancelled and downgraded to free`,
    );
  }

  /**
   * Handle payment failure from webhook
   */
  async handlePaymentFailure(dodoSubscriptionId: string) {
    const subscription = await this.getByDodoSubscriptionId(dodoSubscriptionId);
    if (!subscription) {
      return;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'past_due' },
    });

    this.logger.warn(
      `Subscription ${subscription.id} marked as past_due due to payment failure`,
    );
  }

  /**
   * Update billing period after successful payment
   */
  async updateBillingPeriod(
    dodoSubscriptionId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const subscription = await this.getByDodoSubscriptionId(dodoSubscriptionId);
    if (!subscription) {
      return;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });

    // Reset usage for the new period
    await this.usageTracking.resetMonthlyUsage(subscription.id);

    this.logger.log(
      `Updated billing period for subscription ${subscription.id}`,
    );
  }

  /**
   * Check if a user has access to a feature
   */
  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      return false;
    }

    return this.planService.checkFeatureEnabled(subscription.plan, feature);
  }

  /**
   * Get customer portal URL
   */
  /**
   * Change plan for an existing subscriber.
   * Uses Dodo's changePlan API for active subscriptions, falls back to new checkout.
   */
  async changePlan(
    user: User,
    planSlug: string,
  ): Promise<{ changed: boolean; checkoutUrl?: string }> {
    const plan = await this.planService.getPlanBySlug(planSlug);

    if (!plan.dodoProductId) {
      throw new BadRequestException(
        `Plan '${planSlug}' is not available for purchase`,
      );
    }

    const subscription = await this.getActiveSubscription(user.id);

    // If user has an active Dodo subscription, use changePlan API directly
    if (subscription?.dodoSubscriptionId && subscription.status === 'active') {
      await this.dodoService.changePlan(
        subscription.dodoSubscriptionId,
        plan.dodoProductId,
      );

      this.logger.log(
        `Changed plan for user ${user.id} to ${planSlug} via Dodo changePlan`,
      );

      return { changed: true };
    }

    // No active Dodo subscription - create a new checkout session
    const checkout = await this.createCheckoutSession(user, planSlug);

    return { changed: false, checkoutUrl: checkout.checkoutUrl };
  }

  async getCustomerPortalUrl(userId: string): Promise<string> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription?.dodoCustomerId) {
      throw new BadRequestException(
        'No billing account found. Please upgrade to a paid plan first.',
      );
    }

    const portal = await this.dodoService.createPortalSession(
      subscription.dodoCustomerId,
    );
    return portal.link;
  }

  /**
   * Get current usage stats
   */
  async getCurrentUsage(userId: string) {
    return this.usageTracking.getCurrentUsage(userId);
  }

  /**
   * Check order limit for a restaurant
   */
  async checkOrderLimit(restaurantId: string) {
    return this.usageTracking.checkOrderLimit(restaurantId);
  }

  /**
   * Check location limit for a user
   */
  async checkLocationLimit(userId: string) {
    return this.usageTracking.checkLocationLimit(userId);
  }

  /**
   * Check team member limit for a restaurant
   */
  async checkTeamMemberLimit(restaurantId: string) {
    return this.usageTracking.checkTeamMemberLimit(restaurantId);
  }

  /**
   * Increment order usage after creating an order
   */
  async incrementOrderUsage(restaurantId: string) {
    return this.usageTracking.incrementOrderUsage(restaurantId);
  }
}
