import {
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
  Req,
  Res,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { DodoService } from './dodo.service';
import { SubscriptionService } from '../subscription.service';

interface DodoCustomer {
  customer_id: string;
  name?: string;
  email?: string;
  metadata?: Record<string, string>;
}

interface DodoWebhookPayload {
  business_id: string;
  type: string;
  timestamp: string;
  data: {
    payload_type: string;
    subscription_id?: string;
    customer?: DodoCustomer;
    product_id?: string;
    status?: string;
    // Dodo uses created_at/expires_at instead of current_period_start/end
    created_at?: string;
    expires_at?: string;
    payment_id?: string;
    metadata?: Record<string, string>;
    [key: string]: unknown;
  };
}

@Controller('webhook')
@AllowAnonymous()
export class DodoWebhookController {
  private readonly logger = new Logger(DodoWebhookController.name);

  constructor(
    private prisma: PrismaService,
    private dodoService: DodoService,
    private subscriptionService: SubscriptionService,
  ) {}

  /**
   * Handle Dodo Payments webhooks
   */
  @Post('dodo')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('webhook-id') webhookId: string,
    @Headers('webhook-signature') signature: string,
    @Headers('webhook-timestamp') timestamp: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Get raw body preserved by RawBodyMiddleware
    const rawBody = (req as any).rawBody as string;

    if (!rawBody) {
      this.logger.error(
        'Raw body not available - middleware may not be configured correctly',
      );
      throw new UnauthorizedException('Unable to verify webhook signature');
    }

    this.logger.log(`Received Dodo webhook with id: ${webhookId}`);

    // Verify signature and unwrap payload using SDK
    let payload: DodoWebhookPayload;
    try {
      payload = this.dodoService.verifyAndUnwrapWebhook(rawBody, {
        webhookId,
        webhookSignature: signature,
        webhookTimestamp: timestamp,
      });
    } catch (error) {
      this.logger.warn(`Invalid webhook signature: ${error.message}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log(`Verified Dodo webhook: ${payload.type}`);

    // Check idempotency - skip if already processed
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { eventId: webhookId },
    });

    if (existing) {
      this.logger.debug(`Webhook ${webhookId} already processed`);
      return res.json({ received: true, status: 'already_processed' });
    }

    // Store webhook event
    await this.prisma.webhookEvent.create({
      data: {
        provider: 'dodo',
        eventType: payload.type,
        eventId: webhookId,
        payload: payload as any,
        status: 'pending',
      },
    });

    try {
      // Process the webhook based on type
      await this.processWebhookEvent(payload);

      // Mark as processed
      await this.prisma.webhookEvent.update({
        where: { eventId: webhookId },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      });

      this.logger.log(`Successfully processed webhook: ${payload.type}`);
    } catch (error) {
      this.logger.error(
        `Error processing webhook: ${error.message}`,
        error.stack,
      );

      // Mark as failed
      await this.prisma.webhookEvent.update({
        where: { eventId: webhookId },
        data: {
          status: 'failed',
          errorMessage: error.message,
          retryCount: { increment: 1 },
        },
      });

      // Still return 200 to prevent retries for unrecoverable errors
      // Dodo will retry on 5xx errors
    }

    return res.json({ received: true });
  }

  /**
   * Process webhook event based on type
   */
  private async processWebhookEvent(payload: DodoWebhookPayload) {
    const { type, data } = payload;

    switch (type) {
      case 'subscription.active':
      case 'subscription.updated':
        // Both active and updated events have the same structure and should activate/update subscription
        await this.handleSubscriptionActive(data);
        break;

      case 'subscription.cancelled':
        await this.handleSubscriptionCancelled(data);
        break;

      case 'subscription.past_due':
        await this.handleSubscriptionPastDue(data);
        break;

      case 'payment.succeeded':
        await this.handlePaymentSucceeded(data);
        break;

      case 'payment.failed':
        await this.handlePaymentFailed(data);
        break;

      default:
        this.logger.debug(`Unhandled webhook type: ${type}`);
    }
  }

  /**
   * Handle subscription.active event
   */
  private async handleSubscriptionActive(data: DodoWebhookPayload['data']) {
    const {
      subscription_id,
      customer,
      product_id,
      metadata,
      created_at,
      expires_at,
    } = data;

    // Customer ID is nested inside customer object
    const customer_id = customer?.customer_id;

    if (!subscription_id || !customer_id || !product_id || !metadata) {
      this.logger.warn(
        `Missing required fields in subscription.active webhook: subscription_id=${!!subscription_id}, customer_id=${!!customer_id}, product_id=${!!product_id}, metadata=${!!metadata}`,
      );
      return;
    }

    // Dodo uses created_at/expires_at instead of current_period_start/end
    const periodStart = created_at ? new Date(created_at) : new Date();
    const periodEnd = expires_at
      ? new Date(expires_at)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.subscriptionService.activateSubscription(
      subscription_id,
      customer_id,
      product_id,
      metadata,
      periodStart,
      periodEnd,
    );
  }

  /**
   * Handle subscription.cancelled event
   */
  private async handleSubscriptionCancelled(data: DodoWebhookPayload['data']) {
    const { subscription_id } = data;

    if (!subscription_id) {
      return;
    }

    await this.subscriptionService.handleCancellation(subscription_id);
  }

  /**
   * Handle subscription.past_due event
   */
  private async handleSubscriptionPastDue(data: DodoWebhookPayload['data']) {
    const { subscription_id } = data;

    if (!subscription_id) {
      return;
    }

    await this.subscriptionService.handlePaymentFailure(subscription_id);
  }

  /**
   * Handle payment.succeeded event
   */
  private async handlePaymentSucceeded(data: DodoWebhookPayload['data']) {
    const { subscription_id, created_at, expires_at } = data;

    if (!subscription_id) {
      // One-time payment, not a subscription
      return;
    }

    // Dodo uses created_at/expires_at instead of current_period_start/end
    if (created_at && expires_at) {
      await this.subscriptionService.updateBillingPeriod(
        subscription_id,
        new Date(created_at),
        new Date(expires_at),
      );
    }
  }

  /**
   * Handle payment.failed event
   */
  private async handlePaymentFailed(data: DodoWebhookPayload['data']) {
    const { subscription_id } = data;

    if (!subscription_id) {
      return;
    }

    await this.subscriptionService.handlePaymentFailure(subscription_id);
  }
}
