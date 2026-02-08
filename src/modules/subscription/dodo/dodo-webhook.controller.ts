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
import { SkipThrottle } from '@nestjs/throttler';
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
@SkipThrottle()
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

    // Check idempotency - only skip if already successfully processed
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { eventId: webhookId },
    });

    if (existing && existing.status === 'processed') {
      this.logger.debug(`Webhook ${webhookId} already processed`);
      return res.json({ received: true, status: 'already_processed' });
    }

    // Store or update webhook event (supports retry of failed events)
    await this.prisma.webhookEvent.upsert({
      where: { eventId: webhookId },
      create: {
        provider: 'dodo',
        eventType: payload.type,
        eventId: webhookId,
        payload: payload as any,
        status: 'pending',
      },
      update: {
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

      // Recoverable errors → 500 to trigger Dodo retry
      if (this.isRecoverableError(error)) {
        this.logger.warn(`Recoverable error, returning 500 for retry: ${error.message}`);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          received: true,
          error: 'Temporary failure, please retry',
        });
      }
      // Unrecoverable errors → 200 to ACK and prevent infinite retries
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

      case 'subscription.trialing':
        await this.handleSubscriptionTrialing(data);
        break;

      case 'payment.refunded':
        this.logger.warn(`Payment refunded: ${JSON.stringify({ payment_id: data.payment_id, subscription_id: data.subscription_id })}`);
        break;

      case 'payment.dispute.created':
      case 'payment.dispute.won':
      case 'payment.dispute.lost':
        this.logger.warn(`Payment dispute event: ${type}, data: ${JSON.stringify({ payment_id: data.payment_id, subscription_id: data.subscription_id })}`);
        break;

      default:
        this.logger.warn(`Unhandled webhook type: ${type}`);
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
    const { subscription_id, created_at, expires_at, metadata, payment_id } = data;

    // Check if this is a customer order payment (not a subscription)
    if (metadata?.payment_type === 'customer_order') {
      await this.handleOrderPaymentSucceeded(metadata, payment_id);
      return;
    }

    if (!subscription_id) {
      // One-time payment, not a subscription and not an order
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
   * Handle payment.succeeded for customer order payments
   */
  private async handleOrderPaymentSucceeded(
    metadata: Record<string, string>,
    paymentId?: string,
  ) {
    const { order_id, order_number, business_id } = metadata;

    if (!order_id) {
      this.logger.warn('Order payment webhook missing order_id in metadata');
      return;
    }

    this.logger.log(`Processing order payment: order=${order_number}, dodoPayment=${paymentId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: order_id },
    });

    if (!order) {
      this.logger.warn(`Order ${order_id} not found for Dodo payment webhook`);
      return;
    }

    if (order.paymentStatus === 'paid') {
      this.logger.debug(`Order ${order_id} already paid, skipping`);
      return;
    }

    const pricing = order.pricing as Record<string, number>;
    const orderTotal = pricing.total || 0;

    const paymentNumber = `PAY-DODO-${Date.now().toString(36).toUpperCase()}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          restaurantId: order.restaurantId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentNumber,
          amount: orderTotal,
          method: 'dodo',
          status: 'completed',
          gatewayTransactionId: paymentId || null,
          customerInfo: {
            source: 'dodo_checkout',
            dodoPaymentId: paymentId,
          } as object,
          taxDetails: {} as object,
          processedBy: null,
          processedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'paid',
          balanceDue: 0,
        },
      });
    });

    this.logger.log(`Order ${order.orderNumber} marked as paid via Dodo (payment: ${paymentId})`);
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

  /**
   * Handle subscription.trialing event
   */
  private async handleSubscriptionTrialing(data: DodoWebhookPayload['data']) {
    const { subscription_id } = data;

    if (!subscription_id) {
      return;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { dodoSubscriptionId: subscription_id },
    });

    if (!subscription) {
      this.logger.warn(`Subscription not found for trialing event: ${subscription_id}`);
      return;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'trialing' },
    });

    this.logger.log(`Subscription ${subscription.id} set to trialing`);
  }

  /**
   * Check if an error is recoverable (should trigger retry via 500 response)
   */
  private isRecoverableError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code || '';

    // Prisma connection / timeout errors
    if (code === 'P1001' || code === 'P1002' || code === 'P1008' || code === 'P1017') {
      return true;
    }

    // Network errors
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT') {
      return true;
    }

    // Generic timeout / connection messages
    if (
      message.includes('timeout') ||
      message.includes('connection refused') ||
      message.includes('econnrefused') ||
      message.includes('can\'t reach database')
    ) {
      return true;
    }

    return false;
  }
}
