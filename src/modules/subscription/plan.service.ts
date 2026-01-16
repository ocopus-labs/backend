import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanFeatures } from './interfaces';

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all public subscription plans
   */
  async getAllPublicPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: {
        isPublic: true,
        status: 'active',
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get all plans (including non-public)
   */
  async getAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { status: 'active' },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get plan by slug
   */
  async getPlanBySlug(slug: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { slug },
    });

    if (!plan) {
      throw new NotFoundException(`Plan '${slug}' not found`);
    }

    return plan;
  }

  /**
   * Get plan by ID
   */
  async getPlanById(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan not found`);
    }

    return plan;
  }

  /**
   * Get plan by Dodo product ID
   */
  async getPlanByDodoProductId(dodoProductId: string) {
    return this.prisma.subscriptionPlan.findUnique({
      where: { dodoProductId },
    });
  }

  /**
   * Get the free plan
   */
  async getFreePlan() {
    return this.getPlanBySlug('free');
  }

  /**
   * Check if a feature is enabled for a plan
   */
  checkFeatureEnabled(plan: { features: unknown }, feature: string): boolean {
    const features = plan.features as PlanFeatures;

    switch (feature) {
      case 'kitchenDisplay':
        return features.kitchenDisplay === true;
      case 'analytics_advanced':
        return features.analytics === 'advanced';
      case 'inventory':
        return features.inventory === true;
      case 'expenses':
        return features.expenses === true;
      case 'api':
        return features.api === true;
      case 'whiteLabel':
        return features.whiteLabel === true;
      default:
        return false;
    }
  }

  /**
   * Compare two plans and return the differences
   */
  async comparePlans(currentPlanId: string, newPlanId: string) {
    const [currentPlan, newPlan] = await Promise.all([
      this.getPlanById(currentPlanId),
      this.getPlanById(newPlanId),
    ]);

    const isUpgrade = newPlan.sortOrder > currentPlan.sortOrder;

    return {
      currentPlan,
      newPlan,
      isUpgrade,
      priceDifference: Number(newPlan.priceMonthly) - Number(currentPlan.priceMonthly),
    };
  }
}
