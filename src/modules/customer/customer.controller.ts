import {
  Controller,
  Post,
  Get,
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
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';
import { BusinessRoles, generateCsv } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business/:businessId/customers')
@UsePipes(new ValidationPipe({ transform: true }))
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateCustomerDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.customerService.create(businessId, dto, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  async findAll(
    @Param('businessId') businessId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('tags') tags?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? parseInt(offset, 10) : undefined;
    const parsedTags = tags ? tags.split(',').filter(Boolean) : undefined;

    return this.customerService.findAll(businessId, {
      search,
      status,
      tags: parsedTags,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  @Get('stats')
  async getStats(@Param('businessId') businessId: string) {
    return this.customerService.getStats(businessId);
  }

  @Get('export')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async exportCsv(
    @Param('businessId') businessId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Res() res?: Response,
  ) {
    const customers = await this.customerService.exportCsv(businessId, {
      status,
      search,
    });

    const headers = ['Name', 'Phone', 'Email', 'Status', 'Tags', 'Notes', 'Created'];
    const rows = customers.map((c) => [
      c.name,
      c.phone,
      c.email || '',
      c.status,
      c.tags.join('; '),
      c.notes || '',
      c.createdAt.toISOString().split('T')[0],
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  @Get('search/phone/:phone')
  async findByPhone(
    @Param('businessId') businessId: string,
    @Param('phone') phone: string,
  ) {
    return this.customerService.findByPhone(businessId, phone);
  }

  @Get(':customerId')
  async findById(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customerService.findById(businessId, customerId);
  }

  @Get(':customerId/orders')
  async findWithOrders(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customerService.findWithOrders(businessId, customerId);
  }

  @Patch(':customerId')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async update(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.customerService.update(businessId, customerId, dto, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':customerId')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async delete(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    return this.customerService.delete(businessId, customerId, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
