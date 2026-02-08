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

@Injectable()
export class DodoService {
  private client: DodoPayments;
  private readonly logger = new Logger(DodoService.name);
  private readonly webhookSecret: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('DODO_API_KEY');
    this.webhookSecret =
      this.configService.get<string>('DODO_WEBHOOK_SECRET') || '';
    const isTestMode =
      this.configService.get<string>('DODO_TEST_MODE') === 'true';

    if (!apiKey) {
      this.logger.warn('DODO_API_KEY not configured - Dodo payments disabled');
    }

    this.client = new DodoPayments({
      bearerToken: apiKey || '',
      environment: isTestMode ? 'test_mode' : 'live_mode',
      webhookKey: this.webhookSecret,
    });

    this.logger.log(
      `Dodo Payments initialized in ${isTestMode ? 'TEST' : 'LIVE'} mode`,
    );
    this.logger.log(
      `Webhook key configured: ${this.webhookSecret ? 'yes' : 'no'}`,
    );
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: CreateCheckoutParams) {
    this.logger.log(
      `Creating checkout session for product ${params.productId}`,
    );

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
      throw new Error('Webhook secret not configured');
    }

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

  /**
   * Create a checkout session for a one-time order payment.
   * Requires DODO_ORDER_PRODUCT_ID env var pointing to a PWYW product.
   * Returns null if not configured.
   */
  async createOrderPaymentCheckout(params: {
    orderId: string;
    orderNumber: string;
    trackingToken: string;
    businessId: string;
    amountInSmallestUnit: number; // paise for INR, cents for USD
    customerName: string;
    customerPhone: string;
    returnUrl: string;
  }) {
    const productId = this.configService.get<string>('DODO_ORDER_PRODUCT_ID');
    if (!productId) {
      this.logger.warn(
        'DODO_ORDER_PRODUCT_ID not configured — order payments via Dodo disabled',
      );
      return null;
    }

    this.logger.log(
      `Creating order payment checkout for ${params.orderNumber} (${params.amountInSmallestUnit} smallest units)`,
    );

    const checkout = await this.client.checkoutSessions.create({
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
          amount: params.amountInSmallestUnit,
        },
      ],
      customer: {
        email: `order-${params.customerPhone.replace(/\D/g, '')}@pos.local`,
        name: params.customerName,
        phone_number: params.customerPhone,
      },
      return_url: params.returnUrl,
      metadata: {
        payment_type: 'customer_order',
        order_id: params.orderId,
        order_number: params.orderNumber,
        tracking_token: params.trackingToken,
        business_id: params.businessId,
      },
    });

    return {
      checkoutUrl: checkout.checkout_url,
      sessionId: checkout.session_id,
    };
  }

  /**
   * Check if order payment via Dodo is configured
   */
  isOrderPaymentConfigured(): boolean {
    return !!this.configService.get<string>('DODO_ORDER_PRODUCT_ID');
  }
}
