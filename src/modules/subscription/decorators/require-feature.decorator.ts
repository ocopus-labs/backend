import { SetMetadata } from '@nestjs/common';

export const FEATURE_KEY = 'required_feature';

/**
 * Decorator to require a specific subscription feature
 * Use with SubscriptionGuard
 *
 * @example
 * @Get('kitchen-display')
 * @RequireFeature('kitchenDisplay')
 * @UseGuards(SubscriptionGuard)
 * async getKitchenDisplay() { ... }
 */
export const RequireFeature = (feature: string) =>
  SetMetadata(FEATURE_KEY, feature);
