import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { Session } from '@thallesp/nestjs-better-auth';
import { Throttle } from '@nestjs/throttler';
import { PaymentService } from './payment.service';
import {
  CreatePaymentDto,
  CreateSplitPaymentDto,
  ProcessRefundDto,
} from './dto';
import { BusinessRoles, generateCsv } from 'src/lib/common';
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
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  @Throttle({ short: { ttl: 2000, limit: 1 }, medium: { ttl: 10000, limit: 5 } })
  async createPayment(
    @Param('businessId') businessId: string,
    @Body() dto: CreatePaymentDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.paymentService.createPayment(businessId, session.user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('split')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  @Throttle({ short: { ttl: 2000, limit: 1 }, medium: { ttl: 10000, limit: 5 } })
  async createSplitPayment(
    @Param('businessId') businessId: string,
    @Body() dto: CreateSplitPaymentDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.paymentService.createSplitPayment(businessId, session.user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  async getPayments(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
    @Query('method') method?: PaymentMethod,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.paymentService.getPayments(businessId, {
      method,
      status,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('export')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async exportPayments(
    @Param('businessId') businessId: string,
    @Query('status') status?: string,
    @Query('method') method?: PaymentMethod,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    const { payments } = await this.paymentService.getPayments(businessId, {
      status,
      method,
      fromDate: startDate ? new Date(startDate) : undefined,
      toDate: endDate ? new Date(endDate) : undefined,
      limit: 10000,
      offset: 0,
    });

    const headers = ['Payment #', 'Order #', 'Date', 'Customer', 'Method', 'Amount', 'Status'];
    const rows = payments.map((p: any) => [
      p.paymentNumber || '',
      p.orderNumber || '',
      p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '',
      p.customerInfo?.name || '',
      p.method || '',
      p.amount ?? 0,
      p.status || '',
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  @Get('summary')
  async getPaymentSummary(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
    @Query('date') date?: string,
  ) {
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
    return this.paymentService.getPaymentsByOrder(businessId, orderId);
  }

  @Get(':paymentId')
  async getPaymentById(
    @Param('businessId') businessId: string,
    @Param('paymentId') paymentId: string,
    @Session() session: UserSession,
  ) {
    return this.paymentService.getPaymentById(businessId, paymentId);
  }

  @Get(':paymentId/receipt')
  async generateReceipt(
    @Param('businessId') businessId: string,
    @Param('paymentId') paymentId: string,
    @Session() session: UserSession,
  ) {
    return this.paymentService.generateReceipt(businessId, paymentId);
  }

  @Post(':paymentId/refund')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  @Throttle({ short: { ttl: 2000, limit: 1 }, medium: { ttl: 10000, limit: 3 } })
  async processRefund(
    @Param('businessId') businessId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: ProcessRefundDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.paymentService.processRefund(businessId, paymentId, session.user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get(':paymentId/refunds')
  async getRefunds(
    @Param('businessId') businessId: string,
    @Param('paymentId') paymentId: string,
    @Session() session: UserSession,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.paymentService.getRefunds(businessId, paymentId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Delete(':paymentId')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async softDeletePayment(
    @Param('businessId') businessId: string,
    @Param('paymentId') paymentId: string,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.paymentService.softDelete(businessId, paymentId, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
