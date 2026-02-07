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
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { Session } from '@thallesp/nestjs-better-auth';
import { ExpenseService } from './expense.service';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
  CreateExpenseDto,
  UpdateExpenseDto,
  ApproveExpenseDto,
  RejectExpenseDto,
  MarkAsPaidDto,
} from './dto';
import { BusinessRoles, generateCsv } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { ExpenseStatus } from './interfaces';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business/:businessId/expenses')
@UsePipes(new ValidationPipe({ transform: true }))
export class ExpenseController {
  private readonly logger = new Logger(ExpenseController.name);

  constructor(private expenseService: ExpenseService) {}

  // ============ CATEGORY ENDPOINTS ============

  @Post('categories')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async createCategory(
    @Param('businessId') businessId: string,
    @Body() dto: CreateExpenseCategoryDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const category = await this.expenseService.createCategory(
      businessId,
      dto,
      session.user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );

    return {
      message: 'Expense category created successfully',
      category,
    };
  }

  @Get('categories')
  async findAllCategories(
    @Param('businessId') businessId: string,
    @Query('all') all: string | undefined,
    @Session() session: UserSession,
  ) {
    const categories = await this.expenseService.findAllCategories(
      businessId,
      all !== 'true',
    );

    return { categories };
  }

  @Get('categories/:id')
  async findCategoryById(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const category = await this.expenseService.findCategoryByIdOrFail(businessId, id);
    return { category };
  }

  @Patch('categories/:id')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async updateCategory(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const category = await this.expenseService.updateCategory(
      businessId,
      id,
      dto,
      session.user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );

    return {
      message: 'Expense category updated successfully',
      category,
    };
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async deleteCategory(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    await this.expenseService.deleteCategory(businessId, id, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      message: 'Expense category deleted successfully',
    };
  }

  // ============ EXPENSE ENDPOINTS ============

  @Post()
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER, USER_ROLES.STAFF)
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateExpenseDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const expense = await this.expenseService.create(businessId, dto, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      message: 'Expense created successfully',
      expense,
    };
  }

  @Get()
  async findAll(
    @Param('businessId') businessId: string,
    @Query('categoryId') categoryId: string | undefined,
    @Query('status') status: ExpenseStatus | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Session() session?: UserSession,
  ) {
    const result = await this.expenseService.findAll(businessId, {
      categoryId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return result;
  }

  @Get('export')
  @BusinessRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER, USER_ROLES.MANAGER)
  async exportExpenses(
    @Param('businessId') businessId: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: ExpenseStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    const result = await this.expenseService.findAll(businessId, {
      categoryId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: 10000,
      offset: 0,
    });

    const expenses = result.expenses || [];
    const headers = ['Date', 'Title', 'Category', 'Vendor', 'Amount', 'Tax', 'Payment Method', 'Status'];
    const rows = expenses.map((e: any) => [
      e.expenseDate ? new Date(e.expenseDate).toISOString().split('T')[0] : '',
      e.title || '',
      e.category?.name || '',
      e.vendorName || '',
      e.amount ?? 0,
      e.taxAmount ?? 0,
      e.paymentMethod || '',
      e.status || '',
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="expenses-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  @Get('summary')
  async getSummary(
    @Param('businessId') businessId: string,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Session() session: UserSession,
  ) {
    const summary = await this.expenseService.getSummary(
      businessId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return { summary };
  }

  @Get('pending')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async getPending(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const expenses = await this.expenseService.findAll(businessId, {
      status: 'pending',
    });

    return { expenses };
  }

  @Get(':id')
  async findById(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    const expense = await this.expenseService.findByIdOrFail(businessId, id);
    return { expense };
  }

  @Patch(':id')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const expense = await this.expenseService.update(
      businessId,
      id,
      dto,
      session.user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );

    return {
      message: 'Expense updated successfully',
      expense,
    };
  }

  @Post(':id/approve')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async approve(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: ApproveExpenseDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const expense = await this.expenseService.approve(
      businessId,
      id,
      session.user.id,
      dto.notes,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );

    return {
      message: 'Expense approved successfully',
      expense,
    };
  }

  @Post(':id/reject')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async reject(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: RejectExpenseDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const expense = await this.expenseService.reject(
      businessId,
      id,
      session.user.id,
      dto.reason,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );

    return {
      message: 'Expense rejected',
      expense,
    };
  }

  @Post(':id/mark-paid')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async markAsPaid(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: MarkAsPaidDto,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    const expense = await this.expenseService.markAsPaid(
      businessId,
      id,
      session.user.id,
      dto.notes,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );

    return {
      message: 'Expense marked as paid',
      expense,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER)
  async delete(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
    @Req() req: any,
  ) {
    await this.expenseService.delete(businessId, id, session.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      message: 'Expense deleted successfully',
    };
  }
}
