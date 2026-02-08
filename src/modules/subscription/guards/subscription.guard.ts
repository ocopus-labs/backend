import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(
    private subscriptionService: SubscriptionService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.get<string>(
      FEATURE_KEY,
      context.getHandler(),
    );

    // No feature requirement - allow access
    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const session = request.session;
    const userId = session?.user?.id;

    if (!userId) {
      this.logger.warn('No user ID found in session');
      throw new ForbiddenException('Authentication required');
    }

    const hasAccess = await this.subscriptionService.checkFeatureAccess(
      userId,
      requiredFeature,
    );

    if (!hasAccess) {
      this.logger.debug(
        `User ${userId} denied access to feature: ${requiredFeature}`,
      );
      throw new ForbiddenException(
        `This feature requires a higher subscription plan. Please upgrade to access ${this.getFeatureDisplayName(requiredFeature)}.`,
      );
    }

    return true;
  }

  /**
   * Get human-readable feature name
   */
  private getFeatureDisplayName(feature: string): string {
    const names: Record<string, string> = {
      kitchenDisplay: 'Kitchen Display System',
      analytics_advanced: 'Advanced Analytics',
      inventory: 'Inventory Management',
      expenses: 'Expense Management',
      api: 'API Access',
      whiteLabel: 'White Label Options',
    };

    return names[feature] || feature;
  }
}
