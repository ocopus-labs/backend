import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AllowAnonymous, Session } from 'src/lib/common';
import { BusinessRoles } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { CustomerOrderService } from './customer-order.service';
import {
  CustomerPlaceOrderDto,
  CustomerPaymentDto,
  UpdateOrderingSettingsDto,
  GenerateCustomerPaymentQrDto,
  CreatePaymentCheckoutDto,
} from './dto';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller()
@UsePipes(new ValidationPipe({ transform: true }))
export class CustomerOrderController {
  constructor(private readonly customerOrderService: CustomerOrderService) {}

  // ==================== PUBLIC ENDPOINTS (no auth) ====================

  @Get('public/order/:slug')
  @AllowAnonymous()
  @Throttle({
    short: { ttl: 2000, limit: 5 },
    medium: { ttl: 60000, limit: 30 },
  })
  async getPublicBusinessInfo(@Param('slug') slug: string) {
    return this.customerOrderService.getPublicBusinessInfo(slug);
  }

  @Get('public/order/:slug/menu')
  @AllowAnonymous()
  @Throttle({
    short: { ttl: 2000, limit: 5 },
    medium: { ttl: 60000, limit: 30 },
  })
  async getPublicMenu(@Param('slug') slug: string) {
    return this.customerOrderService.getPublicMenu(slug);
  }

  @Post('public/order/:slug/place')
  @AllowAnonymous()
  @Throttle({
    short: { ttl: 5000, limit: 1 },
    medium: { ttl: 60000, limit: 5 },
    long: { ttl: 3600000, limit: 20 },
  })
  async placeCustomerOrder(
    @Param('slug') slug: string,
    @Body() dto: CustomerPlaceOrderDto,
  ) {
    return this.customerOrderService.placeCustomerOrder(slug, dto);
  }

  @Get('public/order/track/:trackingToken')
  @AllowAnonymous()
  @Throttle({
    short: { ttl: 2000, limit: 3 },
    medium: { ttl: 60000, limit: 60 },
  })
  async getOrderTracking(@Param('trackingToken') trackingToken: string) {
    return this.customerOrderService.getOrderByToken(trackingToken);
  }

  @Post('public/order/track/:trackingToken/payment')
  @AllowAnonymous()
  @Throttle({
    short: { ttl: 5000, limit: 1 },
    medium: { ttl: 60000, limit: 5 },
  })
  async createCustomerPayment(
    @Param('trackingToken') trackingToken: string,
    @Body() dto: CustomerPaymentDto,
  ) {
    return this.customerOrderService.createCustomerPayment(trackingToken, dto);
  }

  @Post('public/order/:slug/payment-qr')
  @AllowAnonymous()
  @Throttle({
    short: { ttl: 3000, limit: 2 },
    medium: { ttl: 60000, limit: 10 },
  })
  async generatePaymentQr(
    @Param('slug') slug: string,
    @Body() dto: GenerateCustomerPaymentQrDto,
  ) {
    return this.customerOrderService.generatePublicPaymentQr(
      slug,
      dto.amount,
      dto.note,
    );
  }

  @Post('public/order/pay/:trackingToken/checkout')
  @AllowAnonymous()
  @Throttle({
    short: { ttl: 5000, limit: 2 },
    medium: { ttl: 60000, limit: 10 },
  })
  async createPaymentCheckout(
    @Param('trackingToken') trackingToken: string,
    @Body() dto: CreatePaymentCheckoutDto,
  ) {
    const result = await this.customerOrderService.createDodoPaymentSession(
      trackingToken,
      dto.returnUrl,
    );

    if (!result) {
      return { checkoutUrl: null, message: 'Online payment not available' };
    }

    return {
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
    };
  }

  // ==================== PROTECTED ENDPOINTS (business owner/manager) ====================

  @Get('business/:businessId/ordering/settings')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async getOrderingSettings(@Param('businessId') businessId: string) {
    const settings =
      await this.customerOrderService.getOrderingSettings(businessId);
    return { settings };
  }

  @Put('business/:businessId/ordering/settings')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async updateOrderingSettings(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateOrderingSettingsDto,
    @Session() session: UserSession,
  ) {
    const settings = await this.customerOrderService.updateOrderingSettings(
      businessId,
      dto,
      session.user.id,
    );
    return { settings };
  }
}
