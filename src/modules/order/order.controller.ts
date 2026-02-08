import {
  Controller,
  Get,
  Post,
  Patch,
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
import { OrderService } from './order.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  AddItemsToOrderDto,
  UpdateItemQuantityDto,
  ApplyDiscountDto,
} from './dto';
import { BusinessRoles, generateCsv } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

@Controller('business/:businessId/orders')
@UsePipes(new ValidationPipe({ transform: true }))
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  async createOrder(
    @Param('businessId') businessId: string,
    @Body() dto: CreateOrderDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.orderService.createOrder(
      businessId,
      session.user.id,
      session.user.name || 'Staff',
      dto,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @Get()
  async getOrders(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('orderType') orderType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.orderService.getOrders(businessId, {
      status,
      paymentStatus,
      orderType,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('active')
  async getActiveOrders(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    return this.orderService.getActiveOrders(businessId);
  }

  @Get('stats')
  async getOrderStats(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
    @Query('date') date?: string,
  ) {
    return this.orderService.getOrderStats(
      businessId,
      date ? new Date(date) : undefined,
    );
  }

  @Get('analytics/top-items')
  async getTopSellingItems(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    return this.orderService.getTopSellingItems(
      businessId,
      limit ? parseInt(limit, 10) : 5,
      days ? parseInt(days, 10) : 7,
    );
  }

  @Get('analytics/peak-hours')
  async getPeakHours(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
    @Query('days') days?: string,
  ) {
    return this.orderService.getPeakHours(
      businessId,
      days ? parseInt(days, 10) : 7,
    );
  }

  @Get('analytics/revenue-trends')
  async getRevenueTrends(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
    @Query('days') days?: string,
  ) {
    return this.orderService.getRevenueTrends(
      businessId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('export')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async exportOrders(
    @Param('businessId') businessId: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    const { orders } = await this.orderService.getOrders(businessId, {
      status,
      fromDate: startDate ? new Date(startDate) : undefined,
      toDate: endDate ? new Date(endDate) : undefined,
      limit: 10000,
      offset: 0,
    });

    const headers = ['Order #', 'Date', 'Customer', 'Type', 'Items Count', 'Subtotal', 'Tax', 'Total', 'Status', 'Payment Status'];
    const rows = orders.map((order: any) => [
      order.orderNumber || '',
      order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '',
      order.customerInfo?.name || 'Walk-in',
      order.orderType || '',
      Array.isArray(order.items) ? order.items.length : 0,
      order.pricing?.subtotal ?? 0,
      order.pricing?.taxAmount ?? 0,
      order.pricing?.total ?? 0,
      order.status || '',
      order.paymentStatus || '',
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  @Get('by-number/:orderNumber')
  async getOrderByNumber(
    @Param('businessId') businessId: string,
    @Param('orderNumber') orderNumber: string,
    @Session() session: UserSession,
  ) {
    return this.orderService.getOrderByNumber(businessId, orderNumber);
  }

  @Get('by-table/:tableId')
  async getOrdersByTable(
    @Param('businessId') businessId: string,
    @Param('tableId') tableId: string,
    @Session() session: UserSession,
  ) {
    return this.orderService.getOrdersByTable(businessId, tableId);
  }

  @Get(':orderId')
  async getOrderById(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Session() session: UserSession,
  ) {
    return this.orderService.getOrderById(businessId, orderId);
  }

  @Patch(':orderId/status')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  async updateOrderStatus(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.orderService.updateOrderStatus(businessId, orderId, session.user.id, dto);
  }

  @Post(':orderId/items')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  async addItemsToOrder(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: AddItemsToOrderDto,
    @Session() session: UserSession,
  ) {
    return this.orderService.addItemsToOrder(businessId, orderId, session.user.id, dto);
  }

  @Patch(':orderId/items/quantity')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  async updateItemQuantity(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateItemQuantityDto,
    @Session() session: UserSession,
  ) {
    return this.orderService.updateItemQuantity(businessId, orderId, session.user.id, dto);
  }

  @Patch(':orderId/items/:itemId/status')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  async updateItemStatus(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body('status') status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled',
    @Session() session: UserSession,
  ) {
    return this.orderService.updateItemStatus(businessId, orderId, session.user.id, itemId, status);
  }

  @Delete(':orderId/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  async removeItemFromOrder(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Session() session: UserSession,
  ) {
    return this.orderService.removeItemFromOrder(businessId, orderId, session.user.id, itemId);
  }

  @Post(':orderId/discount')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  async applyDiscount(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: ApplyDiscountDto,
    @Session() session: UserSession,
  ) {
    return this.orderService.applyDiscount(businessId, orderId, session.user.id, dto);
  }

  @Delete(':orderId')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async softDeleteOrder(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.orderService.softDelete(businessId, orderId, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
