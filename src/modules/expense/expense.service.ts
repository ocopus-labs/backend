import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
  CreateExpenseDto,
  UpdateExpenseDto,
} from './dto';
import {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  EXPENSE_STATUSES,
  ExpenseSummary,
} from './interfaces';

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(private prisma: PrismaService) {}

  // ============ CATEGORY METHODS ============

  async createCategory(
    restaurantId: string,
    dto: CreateExpenseCategoryDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ExpenseCategory> {
    const category = await this.prisma.expenseCategory.create({
      data: {
        restaurantId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        icon: dto.icon,
        isActive: true,
      },
    });

    await this.createAuditLog(restaurantId, userId, 'CREATE', 'expense_category', category.id, {
      name: category.name,
    }, context);

    return category;
  }

  async findAllCategories(restaurantId: string, activeOnly: boolean = true): Promise<ExpenseCategory[]> {
    return this.prisma.expenseCategory.findMany({
      where: {
        restaurantId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findCategoryById(restaurantId: string, id: string): Promise<ExpenseCategory | null> {
    return this.prisma.expenseCategory.findFirst({
      where: { id, restaurantId },
    });
  }

  async findCategoryByIdOrFail(restaurantId: string, id: string): Promise<ExpenseCategory> {
    const category = await this.findCategoryById(restaurantId, id);
    if (!category) {
      throw new NotFoundException(`Expense category with ID ${id} not found`);
    }
    return category;
  }

  async updateCategory(
    restaurantId: string,
    id: string,
    dto: UpdateExpenseCategoryDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<ExpenseCategory> {
    await this.findCategoryByIdOrFail(restaurantId, id);

    const category = await this.prisma.expenseCategory.update({
      where: { id },
      data: dto,
    });

    await this.createAuditLog(restaurantId, userId, 'UPDATE', 'expense_category', id, {
      updatedFields: Object.keys(dto),
    }, context);

    return category;
  }

  async deleteCategory(restaurantId: string, id: string, userId: string, context?: { ipAddress?: string; userAgent?: string }): Promise<void> {
    await this.findCategoryByIdOrFail(restaurantId, id);

    // Check if there are expenses using this category
    const expenseCount = await this.prisma.expense.count({
      where: { categoryId: id },
    });

    if (expenseCount > 0) {
      // Soft delete - mark as inactive
      await this.prisma.expenseCategory.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard delete if no expenses
      await this.prisma.expenseCategory.delete({
        where: { id },
      });
    }

    await this.createAuditLog(restaurantId, userId, 'DELETE', 'expense_category', id, {}, context);
  }

  // ============ EXPENSE METHODS ============

  async create(
    restaurantId: string,
    dto: CreateExpenseDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<Expense> {
    // Validate category exists
    await this.findCategoryByIdOrFail(restaurantId, dto.categoryId);

    const expense = await this.prisma.expense.create({
      data: {
        restaurantId,
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency || 'INR',
        expenseDate: dto.expenseDate,
        paymentMethod: dto.paymentMethod,
        vendorName: dto.vendorName,
        vendorContact: dto.vendorContact,
        receiptUrl: dto.receiptUrl,
        receiptNumber: dto.receiptNumber,
        taxAmount: dto.taxAmount,
        taxPercentage: dto.taxPercentage,
        isRecurring: dto.isRecurring || false,
        recurringFrequency: dto.recurringFrequency,
        recurringEndDate: dto.recurringEndDate,
        tags: dto.tags || [],
        notes: dto.notes,
        status: EXPENSE_STATUSES.PENDING,
        createdBy: userId,
      },
    });

    await this.createAuditLog(restaurantId, userId, 'CREATE', 'expense', expense.id, {
      title: expense.title,
      amount: Number(expense.amount),
    }, context);

    this.logger.log(`Expense ${expense.title} created for restaurant ${restaurantId}`);

    return expense;
  }

  async findAll(
    restaurantId: string,
    options?: {
      categoryId?: string;
      status?: ExpenseStatus;
      startDate?: Date;
      endDate?: Date;
      createdBy?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ expenses: Expense[]; total: number }> {
    const where: Record<string, unknown> = { restaurantId };

    if (options?.categoryId) where.categoryId = options.categoryId;
    if (options?.status) where.status = options.status;
    if (options?.createdBy) where.createdBy = options.createdBy;
    if (options?.startDate || options?.endDate) {
      where.expenseDate = {};
      if (options.startDate) (where.expenseDate as Record<string, Date>).gte = options.startDate;
      if (options.endDate) (where.expenseDate as Record<string, Date>).lte = options.endDate;
    }

    const [expenses, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: {
          category: true,
          creator: { select: { id: true, name: true, email: true } },
          approver: { select: { id: true, name: true, email: true } },
        },
        orderBy: { expenseDate: 'desc' },
        ...(options?.limit !== undefined && { take: options.limit }),
        ...(options?.offset !== undefined && { skip: options.offset }),
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { expenses, total };
  }

  async findById(restaurantId: string, id: string): Promise<Expense | null> {
    return this.prisma.expense.findFirst({
      where: { id, restaurantId },
      include: {
        category: true,
        creator: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findByIdOrFail(restaurantId: string, id: string): Promise<Expense> {
    const expense = await this.findById(restaurantId, id);
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }
    return expense;
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateExpenseDto,
    userId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<Expense> {
    const existing = await this.findByIdOrFail(restaurantId, id);

    if (existing.status !== EXPENSE_STATUSES.PENDING) {
      throw new BadRequestException('Only pending expenses can be updated');
    }

    // Validate category if being changed
    if (dto.categoryId) {
      await this.findCategoryByIdOrFail(restaurantId, dto.categoryId);
    }

    const expense = await this.prisma.expense.update({
      where: { id },
      data: dto,
      include: {
        category: true,
      },
    });

    await this.createAuditLog(restaurantId, userId, 'UPDATE', 'expense', id, {
      updatedFields: Object.keys(dto),
    }, context);

    return expense;
  }

  async approve(
    restaurantId: string,
    id: string,
    userId: string,
    notes?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<Expense> {
    const expense = await this.findByIdOrFail(restaurantId, id);

    if (expense.status !== EXPENSE_STATUSES.PENDING) {
      throw new BadRequestException('Only pending expenses can be approved');
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: EXPENSE_STATUSES.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
        notes: notes || expense.notes,
      },
      include: {
        category: true,
      },
    });

    await this.createAuditLog(restaurantId, userId, 'APPROVE', 'expense', id, {
      title: expense.title,
    }, context);

    return updated;
  }

  async reject(
    restaurantId: string,
    id: string,
    userId: string,
    reason: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<Expense> {
    const expense = await this.findByIdOrFail(restaurantId, id);

    if (expense.status !== EXPENSE_STATUSES.PENDING) {
      throw new BadRequestException('Only pending expenses can be rejected');
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: EXPENSE_STATUSES.REJECTED,
        approvedBy: userId,
        approvedAt: new Date(),
        notes: reason,
      },
      include: {
        category: true,
      },
    });

    await this.createAuditLog(restaurantId, userId, 'REJECT', 'expense', id, {
      title: expense.title,
      reason,
    }, context);

    return updated;
  }

  async markAsPaid(
    restaurantId: string,
    id: string,
    userId: string,
    notes?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<Expense> {
    const expense = await this.findByIdOrFail(restaurantId, id);

    if (expense.status !== EXPENSE_STATUSES.APPROVED) {
      throw new BadRequestException('Only approved expenses can be marked as paid');
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: EXPENSE_STATUSES.PAID,
        notes: notes || expense.notes,
      },
      include: {
        category: true,
      },
    });

    await this.createAuditLog(restaurantId, userId, 'MARK_PAID', 'expense', id, {
      title: expense.title,
    }, context);

    return updated;
  }

  async delete(restaurantId: string, id: string, userId: string, context?: { ipAddress?: string; userAgent?: string }): Promise<void> {
    const expense = await this.findByIdOrFail(restaurantId, id);

    if (expense.status === EXPENSE_STATUSES.PAID) {
      throw new BadRequestException('Paid expenses cannot be deleted');
    }

    await this.prisma.expense.delete({
      where: { id },
    });

    await this.createAuditLog(restaurantId, userId, 'DELETE', 'expense', id, {
      title: expense.title,
    }, context);

    this.logger.log(`Expense ${expense.title} deleted from restaurant ${restaurantId}`);
  }

  async getSummary(
    restaurantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ExpenseSummary> {
    const where: Record<string, unknown> = { restaurantId };
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) (where.expenseDate as Record<string, Date>).gte = startDate;
      if (endDate) (where.expenseDate as Record<string, Date>).lte = endDate;
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      include: { category: true },
    });

    const summary: ExpenseSummary = {
      totalAmount: 0,
      pendingAmount: 0,
      approvedAmount: 0,
      paidAmount: 0,
      categoryBreakdown: {},
      monthlyTrend: [],
    };

    const monthlyMap = new Map<string, number>();

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      summary.totalAmount += amount;

      switch (expense.status) {
        case EXPENSE_STATUSES.PENDING:
          summary.pendingAmount += amount;
          break;
        case EXPENSE_STATUSES.APPROVED:
          summary.approvedAmount += amount;
          break;
        case EXPENSE_STATUSES.PAID:
          summary.paidAmount += amount;
          break;
      }

      // Category breakdown
      const categoryName = (expense as any).category?.name || 'Unknown';
      if (!summary.categoryBreakdown[categoryName]) {
        summary.categoryBreakdown[categoryName] = 0;
      }
      summary.categoryBreakdown[categoryName] += amount;

      // Monthly trend
      const monthKey = expense.expenseDate.toISOString().substring(0, 7);
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + amount);
    }

    summary.monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return summary;
  }

  private async createAuditLog(
    restaurantId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    details: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        restaurantId,
        userId,
        action,
        resource,
        resourceId,
        details: details as object,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      },
    });
  }
}
