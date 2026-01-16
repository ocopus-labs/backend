import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { ExpenseService } from './expense.service';
import { BusinessService } from 'src/modules/business';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
  CreateExpenseDto,
  UpdateExpenseDto,
  ApproveExpenseDto,
  RejectExpenseDto,
  MarkAsPaidDto,
} from './dto';
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

  constructor(
    private expenseService: ExpenseService,
    private businessService: BusinessService,
  ) {}

  // ============ CATEGORY ENDPOINTS ============

  @Post('categories')
  async createCategory(
    @Param('businessId') businessId: string,
    @Body() dto: CreateExpenseCategoryDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const category = await this.expenseService.createCategory(
      businessId,
      dto,
      session.user.id,
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
    await this.validateAccess(session.user.id, businessId);

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
    await this.validateAccess(session.user.id, businessId);

    const category = await this.expenseService.findCategoryByIdOrFail(businessId, id);
    return { category };
  }

  @Patch('categories/:id')
  async updateCategory(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const category = await this.expenseService.updateCategory(
      businessId,
      id,
      dto,
      session.user.id,
    );

    return {
      message: 'Expense category updated successfully',
      category,
    };
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCategory(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

    await this.expenseService.deleteCategory(businessId, id, session.user.id);

    return {
      message: 'Expense category deleted successfully',
    };
  }

  // ============ EXPENSE ENDPOINTS ============

  @Post()
  async create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateExpenseDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
      USER_ROLES.STAFF,
    ]);

    const expense = await this.expenseService.create(businessId, dto, session.user.id);

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
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const expenses = await this.expenseService.findAll(businessId, {
      categoryId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return { expenses };
  }

  @Get('summary')
  async getSummary(
    @Param('businessId') businessId: string,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const summary = await this.expenseService.getSummary(
      businessId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return { summary };
  }

  @Get('pending')
  async getPending(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

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
    await this.validateAccess(session.user.id, businessId);

    const expense = await this.expenseService.findByIdOrFail(businessId, id);
    return { expense };
  }

  @Patch(':id')
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const expense = await this.expenseService.update(
      businessId,
      id,
      dto,
      session.user.id,
    );

    return {
      message: 'Expense updated successfully',
      expense,
    };
  }

  @Post(':id/approve')
  async approve(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: ApproveExpenseDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const expense = await this.expenseService.approve(
      businessId,
      id,
      session.user.id,
      dto.notes,
    );

    return {
      message: 'Expense approved successfully',
      expense,
    };
  }

  @Post(':id/reject')
  async reject(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: RejectExpenseDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const expense = await this.expenseService.reject(
      businessId,
      id,
      session.user.id,
      dto.reason,
    );

    return {
      message: 'Expense rejected',
      expense,
    };
  }

  @Post(':id/mark-paid')
  async markAsPaid(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: MarkAsPaidDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

    const expense = await this.expenseService.markAsPaid(
      businessId,
      id,
      session.user.id,
      dto.notes,
    );

    return {
      message: 'Expense marked as paid',
      expense,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

    await this.expenseService.delete(businessId, id, session.user.id);

    return {
      message: 'Expense deleted successfully',
    };
  }

  private async validateAccess(
    userId: string,
    businessId: string,
    allowedRoles?: string[],
  ): Promise<void> {
    const hasAccess = await this.businessService.checkUserAccess(userId, businessId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    if (allowedRoles) {
      const role = await this.businessService.getUserRole(userId, businessId);
      if (!role || !allowedRoles.includes(role)) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
    }
  }
}
