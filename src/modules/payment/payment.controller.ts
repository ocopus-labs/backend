import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { PaymentService } from './payment.service';
import {
  CreatePaymentDto,
  CreateSplitPaymentDto,
  ProcessRefundDto,
} from './dto';
import { BusinessService } from '../business/business.service';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import type { PaymentMethod } from './interfaces';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

@Controller('business/:businessId/payments')
@UsePipes(new ValidationPipe({ transform: true }))
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly businessService: BusinessService,
  ) {}

  private async validateAccess(userId: string, businessId: string): Promise<void> {
    const hasAccess = await this.businessService.checkUserAccess(userId, businessId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }

  private async validateWriteAccess(userId: string, businessId: string): Promise<void> {
    await this.validateAccess(userId, businessId);
    const role = await this.businessService.getUserRole(userId, businessId);
    const writeRoles: string[] = [
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.MANAGER,
      USER_ROLES.STAFF,
    ];
    if (!role || !writeRoles.includes(role)) {
      throw new ForbiddenException('You do not have permission to process payments');
    }
  }

  private async validateRefundAccess(userId: string, businessId: string): Promise<void> {
    await this.validateAccess(userId, businessId);
    const role = await this.businessService.getUserRole(userId, businessId);
    const refundRoles: string[] = [
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.MANAGER,
    ];
    if (!role || !refundRoles.includes(role)) {
      throw new ForbiddenException('You do not have permission to process refunds');
    }
  }

  @Post()
  async createPayment(
    @Param('businessId') businessId: string,
    @Body() dto: CreatePaymentDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    return this.paymentService.createPayment(businessId, session.user.id, dto);
  }

  @Post('split')
  async createSplitPayment(
    @Param('businessId') businessId: string,
    @Body() dto: CreateSplitPaymentDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    return this.paymentService.createSplitPayment(businessId, session.user.id, dto);
  }

  @Get()
  async getPayments(
    @Param('businessId') businessId: string,
    @Query('method') method?: PaymentMethod,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Session() session?: UserSession,
  ) {
    if (session) {
      await this.validateAccess(session.user.id, businessId);
    }
    return this.paymentService.getPayments(businessId, {
      method,
      status,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('summary')
  async getPaymentSummary(
    @Param('businessId') businessId: string,
    @Query('date') date?: string,
    @Session() session?: UserSession,
  ) {
    if (session) {
      await this.validateAccess(session.user.id, businessId);
    }
    return this.paymentService.getPaymentSummary(
      businessId,
      date ? new Date(date) : undefined,
    );
  }

  @Get('order/:orderId')
  async getPaymentsByOrder(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    return this.paymentService.getPaymentsByOrder(businessId, orderId);
  }

  @Get(':paymentId')
  async getPaymentById(
    @Param('businessId') businessId: string,
    @Param('paymentId') paymentId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    return this.paymentService.getPaymentById(businessId, paymentId);
  }

  @Get(':paymentId/receipt')
  async generateReceipt(
    @Param('businessId') businessId: string,
    @Param('paymentId') paymentId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    return this.paymentService.generateReceipt(businessId, paymentId);
  }

  @Post(':paymentId/refund')
  @HttpCode(HttpStatus.OK)
  async processRefund(
    @Param('businessId') businessId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: ProcessRefundDto,
    @Session() session: UserSession,
  ) {
    await this.validateRefundAccess(session.user.id, businessId);
    return this.paymentService.processRefund(businessId, paymentId, session.user.id, dto);
  }
}
