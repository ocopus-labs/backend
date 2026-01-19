import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import DodoPayments from 'dodopayments';

interface CreateCheckoutParams {
  productId: string;
  customerEmail: string;
  customerName: string;
  customerId?: string;
  returnUrl: string;
  metadata?: Record<string, string>;
}

interface IngestUsageParams {
  customerId: string;
  meterId: string;
  value: number;
  restaurantId: string;
}

@Injectable()
export class DodoService {
  private client: DodoPayments;
  private readonly logger = new Logger(DodoService.name);
  private readonly webhookSecret: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('DODO_API_KEY');
    this.webhookSecret =
      this.configService.get<string>('DODO_WEBHOOK_SECRET') || '';
    const isTestMode = this.configService.get<string>('DODO_TEST_MODE') === 'true';

    if (!apiKey) {
      this.logger.warn('DODO_API_KEY not configured - Dodo payments disabled');
    }

    this.client = new DodoPayments({
      bearerToken: apiKey || '',
      environment: isTestMode ? 'test_mode' : 'live_mode',
      webhookKey: this.webhookSecret,
    });

    this.logger.log(`Dodo Payments initialized in ${isTestMode ? 'TEST' : 'LIVE'} mode`);
    this.logger.log(`Webhook key configured: ${this.webhookSecret ? 'yes (starts with ' + this.webhookSecret.substring(0, 6) + ')' : 'no'}`);
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: CreateCheckoutParams) {
    this.logger.log(`Creating checkout session for product ${params.productId}`);

    const checkoutParams: any = {
      product_cart: [
        {
          product_id: params.productId,
          quantity: 1,
        },
      ],
      return_url: params.returnUrl,
      metadata: params.metadata || {},
    };

    if (params.customerId) {
      checkoutParams.customer = { customer_id: params.customerId };
    } else {
      checkoutParams.customer = {
        email: params.customerEmail,
        name: params.customerName || params.customerEmail.split('@')[0],
      };
    }

    const checkout = await this.client.checkoutSessions.create(checkoutParams);

    return {
      checkoutUrl: checkout.checkout_url,
      sessionId: checkout.session_id,
    };
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string) {
    return this.client.subscriptions.retrieve(subscriptionId);
  }

  /**
   * List subscriptions for a customer
   */
  async listSubscriptions(customerId: string) {
    return this.client.subscriptions.list({ customer_id: customerId });
  }

  /**
   * Change subscription plan
   */
  async changePlan(subscriptionId: string, newProductId: string) {
    return this.client.subscriptions.changePlan(subscriptionId, {
      product_id: newProductId,
      proration_billing_mode: 'prorated_immediately',
      quantity: 1,
    });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string) {
    return this.client.subscriptions.update(subscriptionId, {
      status: 'cancelled',
    });
  }

  /**
   * Create customer portal session
   */
  async createPortalSession(customerId: string) {
    return this.client.customers.customerPortal.create(customerId);
  }

  /**
   * Ingest usage event for meters
   */
  async ingestUsageEvent(params: IngestUsageParams) {
    this.logger.debug(
      `Ingesting usage event: ${params.value} for customer ${params.customerId}`,
    );

    return this.client.webhookEvents;
  }

  /**
   * Create a customer in Dodo
   */
  async createCustomer(params: { email: string; name: string }) {
    return this.client.customers.create({
      email: params.email,
      name: params.name,
    });
  }

  /**
   * Get customer details
   */
  async getCustomer(customerId: string) {
    return this.client.customers.retrieve(customerId);
  }

  /**
   * Verify and unwrap webhook payload using SDK
   */
  verifyAndUnwrapWebhook(
    rawBody: string,
    headers: {
      webhookId: string;
      webhookSignature: string;
      webhookTimestamp: string;
    },
  ): any {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured');
      throw new Error('Webhook secret not configured');
    }

    this.logger.debug(`Verifying webhook - id: ${headers.webhookId}, timestamp: ${headers.webhookTimestamp}`);
    this.logger.debug(`Raw body length: ${rawBody.length}, first 100 chars: ${rawBody.substring(0, 100)}`);

    // Debug: Check for encoding issues - show hex of first/last few bytes
    const bodyBuffer = Buffer.from(rawBody);
    this.logger.debug(`Raw body first 20 bytes hex: ${bodyBuffer.slice(0, 20).toString('hex')}`);
    this.logger.debug(`Raw body last 20 bytes hex: ${bodyBuffer.slice(-20).toString('hex')}`);
    this.logger.debug(`Raw body byte length: ${bodyBuffer.length}`);

    // Debug: manually compute signature to compare
    const crypto = require('crypto');
    const secretPart = this.webhookSecret.startsWith('whsec_')
      ? this.webhookSecret.substring(6)
      : this.webhookSecret;
    const secretKey = Buffer.from(secretPart, 'base64');
    const signedContent = `${headers.webhookId}.${headers.webhookTimestamp}.${rawBody}`;
    this.logger.debug(`Signed content length: ${signedContent.length}`);
    const expectedSig = crypto.createHmac('sha256', secretKey).update(signedContent).digest('base64');
    this.logger.debug(`Expected signature: v1,${expectedSig}`);
    this.logger.debug(`Received signature: ${headers.webhookSignature}`);

    try {
      return this.client.webhooks.unwrap(rawBody, {
        headers: {
          'webhook-id': headers.webhookId,
          'webhook-signature': headers.webhookSignature,
          'webhook-timestamp': headers.webhookTimestamp,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to verify webhook signature: ${error.message}`);
      this.logger.error(`Headers: id=${headers.webhookId}, sig=${headers.webhookSignature?.substring(0, 20)}..., ts=${headers.webhookTimestamp}`);
      throw error;
    }
  }

  /**
   * Get list of products
   */
  async listProducts() {
    return this.client.products.list();
  }

  /**
   * Get product details
   */
  async getProduct(productId: string) {
    return this.client.products.retrieve(productId);
  }
}
