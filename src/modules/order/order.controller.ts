import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { OrderService } from './order.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  AddItemsToOrderDto,
  UpdateItemQuantityDto,
  ApplyDiscountDto,
} from './dto';
import { BusinessService } from '../business/business.service';
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
  constructor(
    private readonly orderService: OrderService,
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
      throw new ForbiddenException('You do not have permission to manage orders');
    }
  }

  @Post()
  async createOrder(
    @Param('businessId') businessId: string,
    @Body() dto: CreateOrderDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    return this.orderService.createOrder(
      businessId,
      session.user.id,
      session.user.name || 'Staff',
      dto,
    );
  }

  @Get()
  async getOrders(
    @Param('businessId') businessId: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('orderType') orderType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Session() session?: UserSession,
  ) {
    if (session) {
      await this.validateAccess(session.user.id, businessId);
    }
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
    await this.validateAccess(session.user.id, businessId);
    return this.orderService.getActiveOrders(businessId);
  }

  @Get('stats')
  async getOrderStats(
    @Param('businessId') businessId: string,
    @Query('date') date?: string,
    @Session() session?: UserSession,
  ) {
    if (session) {
      await this.validateAccess(session.user.id, businessId);
    }
    return this.orderService.getOrderStats(
      businessId,
      date ? new Date(date) : undefined,
    );
  }

  @Get('analytics/top-items')
  async getTopSellingItems(
    @Param('businessId') businessId: string,
    @Query('limit') limit?: string,
    @Query('days') days?: string,
    @Session() session?: UserSession,
  ) {
    if (session) {
      await this.validateAccess(session.user.id, businessId);
    }
    return this.orderService.getTopSellingItems(
      businessId,
      limit ? parseInt(limit, 10) : 5,
      days ? parseInt(days, 10) : 7,
    );
  }

  @Get('analytics/peak-hours')
  async getPeakHours(
    @Param('businessId') businessId: string,
    @Query('days') days?: string,
    @Session() session?: UserSession,
  ) {
    if (session) {
      await this.validateAccess(session.user.id, businessId);
    }
    return this.orderService.getPeakHours(
      businessId,
      days ? parseInt(days, 10) : 7,
    );
  }

  @Get('analytics/revenue-trends')
  async getRevenueTrends(
    @Param('businessId') businessId: string,
    @Query('days') days?: string,
    @Session() session?: UserSession,
  ) {
    if (session) {
      await this.validateAccess(session.user.id, businessId);
    }
    return this.orderService.getRevenueTrends(
      businessId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('by-number/:orderNumber')
  async getOrderByNumber(
    @Param('businessId') businessId: string,
    @Param('orderNumber') orderNumber: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    return this.orderService.getOrderByNumber(businessId, orderNumber);
  }

  @Get('by-table/:tableId')
  async getOrdersByTable(
    @Param('businessId') businessId: string,
    @Param('tableId') tableId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    return this.orderService.getOrdersByTable(businessId, tableId);
  }

  @Get(':orderId')
  async getOrderById(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);
    return this.orderService.getOrderById(businessId, orderId);
  }

  @Patch(':orderId/status')
  async updateOrderStatus(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    return this.orderService.updateOrderStatus(businessId, orderId, session.user.id, dto);
  }

  @Post(':orderId/items')
  async addItemsToOrder(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: AddItemsToOrderDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    return this.orderService.addItemsToOrder(businessId, orderId, session.user.id, dto);
  }

  @Patch(':orderId/items/quantity')
  async updateItemQuantity(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateItemQuantityDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    return this.orderService.updateItemQuantity(businessId, orderId, session.user.id, dto);
  }

  @Patch(':orderId/items/:itemId/status')
  async updateItemStatus(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body('status') status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled',
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    return this.orderService.updateItemStatus(businessId, orderId, session.user.id, itemId, status);
  }

  @Delete(':orderId/items/:itemId')
  @HttpCode(HttpStatus.OK)
  async removeItemFromOrder(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    return this.orderService.removeItemFromOrder(businessId, orderId, session.user.id, itemId);
  }

  @Post(':orderId/discount')
  async applyDiscount(
    @Param('businessId') businessId: string,
    @Param('orderId') orderId: string,
    @Body() dto: ApplyDiscountDto,
    @Session() session: UserSession,
  ) {
    await this.validateWriteAccess(session.user.id, businessId);
    return this.orderService.applyDiscount(businessId, orderId, session.user.id, dto);
  }
}
