import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import type { LoyaltySettings } from './interfaces';
import { DEFAULT_LOYALTY_SETTINGS } from './interfaces';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(businessId: string): Promise<LoyaltySettings> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const settings = restaurant.settings as Record<string, unknown>;
    return {
      ...DEFAULT_LOYALTY_SETTINGS,
      ...(settings?.loyalty as Partial<LoyaltySettings>),
    };
  }

  async updateSettings(
    businessId: string,
    updates: Partial<LoyaltySettings>,
    userId: string,
  ): Promise<LoyaltySettings> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const existingSettings = restaurant.settings as Record<string, unknown>;
    const currentLoyalty = {
      ...DEFAULT_LOYALTY_SETTINGS,
      ...(existingSettings?.loyalty as Partial<LoyaltySettings>),
    };

    const newLoyalty: LoyaltySettings = {
      ...currentLoyalty,
      ...updates,
      tiers: { ...currentLoyalty.tiers, ...updates.tiers },
      tierMultipliers: {
        ...currentLoyalty.tierMultipliers,
        ...updates.tierMultipliers,
      },
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.restaurant.update({
        where: { id: businessId },
        data: {
          settings: {
            ...existingSettings,
            loyalty: newLoyalty,
          } as object,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId,
          action: 'loyalty.settings_updated',
          resource: 'loyalty',
          details: { changes: updates } as object,
        },
      });
    });

    return newLoyalty;
  }

  async getAccount(businessId: string, customerId: string) {
    // Verify customer belongs to this business
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, restaurantId: businessId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Get or auto-create loyalty account
    let account = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId },
    });

    if (!account) {
      account = await this.prisma.loyaltyAccount.create({
        data: {
          customerId,
          restaurantId: businessId,
        },
      });
    }

    return account;
  }

  async getAccountWithTransactions(
    businessId: string,
    customerId: string,
    opts?: { limit?: number; offset?: number },
  ) {
    const account = await this.getAccount(businessId, customerId);

    const [transactions, total] = await Promise.all([
      this.prisma.loyaltyTransaction.findMany({
        where: { loyaltyAccountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: opts?.limit || 20,
        skip: opts?.offset || 0,
      }),
      this.prisma.loyaltyTransaction.count({
        where: { loyaltyAccountId: account.id },
      }),
    ]);

    return { account, transactions, total };
  }

  async awardPointsForOrder(
    businessId: string,
    customerId: string,
    orderId: string,
  ) {
    const settings = await this.getSettings(businessId);

    if (!settings.enabled) {
      return null;
    }

    // Idempotency check — skip if already awarded for this order
    const existing = await this.prisma.loyaltyTransaction.findFirst({
      where: { orderId, type: 'earn' },
    });

    if (existing) {
      this.logger.debug(`Loyalty points already awarded for order ${orderId}`);
      return null;
    }

    // Get order pricing
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId: businessId },
      select: { pricing: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const pricing = order.pricing as { subtotal: number };
    const account = await this.getAccount(businessId, customerId);

    // Calculate points: subtotal × pointsPerUnit × tierMultiplier
    const tierMultiplier =
      settings.tierMultipliers[
        account.tier as keyof typeof settings.tierMultipliers
      ] || 1;
    const rawPoints = Math.floor(
      pricing.subtotal * settings.pointsPerUnit * tierMultiplier,
    );

    if (rawPoints <= 0) {
      return null;
    }

    const newBalance = account.points + rawPoints;
    const newLifetime = account.lifetimePoints + rawPoints;

    // Determine new tier
    const newTier = this.calculateTier(newLifetime, settings, account.tier);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: newBalance,
          lifetimePoints: newLifetime,
          tier: newTier,
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          type: 'earn',
          points: rawPoints,
          balance: newBalance,
          orderId,
          description: `Earned ${rawPoints} points for order`,
        },
      });

      return updatedAccount;
    });

    if (newTier !== account.tier) {
      this.logger.log(
        `Customer ${customerId} upgraded from ${account.tier} to ${newTier}`,
      );
    }

    return result;
  }

  async redeemPoints(businessId: string, customerId: string, points: number) {
    const settings = await this.getSettings(businessId);

    if (!settings.enabled) {
      throw new BadRequestException('Loyalty program is not enabled');
    }

    if (points < settings.minimumRedemption) {
      throw new BadRequestException(
        `Minimum redemption is ${settings.minimumRedemption} points`,
      );
    }

    const account = await this.getAccount(businessId, customerId);

    if (account.points < points) {
      throw new BadRequestException(
        `Insufficient points. Available: ${account.points}`,
      );
    }

    const discountAmount = points * settings.redemptionRate;
    const newBalance = account.points - points;

    await this.prisma.$transaction(async (tx) => {
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: newBalance },
      });

      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          type: 'redeem',
          points: -points,
          balance: newBalance,
          description: `Redeemed ${points} points for ${discountAmount} discount`,
        },
      });
    });

    return { discountAmount, newBalance };
  }

  async adjustPoints(
    businessId: string,
    customerId: string,
    points: number,
    reason: string,
    userId: string,
  ) {
    const account = await this.getAccount(businessId, customerId);

    const newBalance = account.points + points;

    if (newBalance < 0) {
      throw new BadRequestException(
        'Adjustment would result in negative balance',
      );
    }

    const newLifetime =
      points > 0 ? account.lifetimePoints + points : account.lifetimePoints;

    const settings = await this.getSettings(businessId);
    const newTier = this.calculateTier(newLifetime, settings, account.tier);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: newBalance,
          lifetimePoints: newLifetime,
          tier: newTier,
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          type: 'adjust',
          points,
          balance: newBalance,
          description: reason,
          createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId,
          action: 'loyalty.points_adjusted',
          resource: 'loyalty',
          resourceId: account.id,
          details: { customerId, points, reason } as object,
        },
      });

      return updatedAccount;
    });

    return result;
  }

  async getLeaderboard(businessId: string, limit: number = 10) {
    const accounts = await this.prisma.loyaltyAccount.findMany({
      where: { restaurantId: businessId },
      orderBy: { lifetimePoints: 'desc' },
      take: limit,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return accounts.map((a) => ({
      customerId: a.customer.id,
      customerName: a.customer.name,
      customerPhone: a.customer.phone,
      points: a.points,
      lifetimePoints: a.lifetimePoints,
      tier: a.tier,
    }));
  }

  private calculateTier(
    lifetimePoints: number,
    settings: LoyaltySettings,
    currentTier: string,
  ): string {
    const tiers = ['bronze', 'silver', 'gold', 'platinum'] as const;
    const currentIndex = tiers.indexOf(currentTier as (typeof tiers)[number]);

    let newTier = 'bronze';
    if (lifetimePoints >= settings.tiers.platinum) {
      newTier = 'platinum';
    } else if (lifetimePoints >= settings.tiers.gold) {
      newTier = 'gold';
    } else if (lifetimePoints >= settings.tiers.silver) {
      newTier = 'silver';
    }

    // Never downgrade tier
    const newIndex = tiers.indexOf(newTier as (typeof tiers)[number]);
    return newIndex > currentIndex ? newTier : currentTier;
  }
}
