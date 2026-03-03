import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SubscriptionService } from './subscription.service';
import { PlanService } from './plan.service';
import { CreateCheckoutDto, ChangePlanDto } from './dto';
import { HttpCacheTTL } from 'src/lib/common';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

@Controller('subscription')
@UsePipes(new ValidationPipe({ transform: true }))
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(
    private subscriptionService: SubscriptionService,
    private planService: PlanService,
  ) {}

  /**
   * Get all available subscription plans
   */
  @Get('plans')
  @AllowAnonymous()
  @HttpCacheTTL(300) // Cache plans for 5 minutes
  async getPlans() {
    const plans = await this.planService.getAllPublicPlans();
    return { plans };
  }

  /**
   * Get current user's subscription
   */
  @Get('me')
  async getMySubscription(@Session() session: UserSession) {
    const subscription = await this.subscriptionService.ensureSubscription(
      session.user.id,
    );

    this.logger.debug(
      `User ${session.user.id} subscription: plan=${subscription.plan.slug}, status=${subscription.status}`,
    );

    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: {
          id: subscription.plan.id,
          name: subscription.plan.name,
          slug: subscription.plan.slug,
          displayName: subscription.plan.displayName,
          priceMonthly: subscription.plan.priceMonthly,
          features: subscription.plan.features,
          maxLocations: subscription.plan.maxLocations,
          maxTeamMembers: subscription.plan.maxTeamMembers,
          maxOrdersPerMonth: subscription.plan.maxOrdersPerMonth,
          sortOrder: subscription.plan.sortOrder,
        },
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        hasBillingAccount: !!subscription.dodoCustomerId,
      },
    };
  }

  /**
   * Get subscription for a business (returns the owner's subscription)
   * Any team member can check what features the business has access to
   */
  @Get('business/:businessId')
  @HttpCacheTTL(60)
  async getBusinessSubscription(@Param('businessId') businessId: string) {
    const subscription =
      await this.subscriptionService.getBusinessSubscription(businessId);

    if (!subscription) {
      return { subscription: null };
    }

    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: {
          id: subscription.plan.id,
          name: subscription.plan.name,
          slug: subscription.plan.slug,
          displayName: subscription.plan.displayName,
          priceMonthly: subscription.plan.priceMonthly,
          features: subscription.plan.features,
          maxLocations: subscription.plan.maxLocations,
          maxTeamMembers: subscription.plan.maxTeamMembers,
          maxOrdersPerMonth: subscription.plan.maxOrdersPerMonth,
          sortOrder: subscription.plan.sortOrder,
        },
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    };
  }

  /**
   * Create checkout session for upgrading
   */
  @Post('checkout')
  async createCheckout(
    @Body() dto: CreateCheckoutDto,
    @Session() session: UserSession,
  ) {
    const checkout = await this.subscriptionService.createCheckoutSession(
      session.user as any,
      dto.planSlug,
      dto.returnUrl,
    );

    return {
      checkoutUrl: checkout.checkoutUrl,
    };
  }

  /**
   * Change subscription plan
   */
  @Post('change-plan')
  async changePlan(
    @Body() dto: ChangePlanDto,
    @Session() session: UserSession,
  ) {
    const result = await this.subscriptionService.changePlan(
      session.user as any,
      dto.planSlug,
    );

    if (result.changed) {
      return { message: 'Plan changed successfully' };
    }

    return {
      checkoutUrl: result.checkoutUrl,
      message: 'Please complete checkout to change your plan',
    };
  }

  /**
   * Cancel subscription
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Session() session: UserSession) {
    const result = await this.subscriptionService.cancelSubscription(
      session.user.id,
    );

    return {
      message: result.cancelAtPeriodEnd
        ? 'Subscription will be cancelled at the end of the billing period'
        : 'Subscription cancelled immediately',
      ...result,
    };
  }

  /**
   * Get current usage stats
   */
  @Get('usage')
  async getUsage(@Session() session: UserSession) {
    const usage = await this.subscriptionService.getCurrentUsage(
      session.user.id,
    );
    return { usage };
  }

  /**
   * Get customer portal URL for managing billing
   */
  @Post('portal')
  async getPortalUrl(@Session() session: UserSession) {
    const url = await this.subscriptionService.getCustomerPortalUrl(
      session.user.id,
    );

    return { url };
  }
}
