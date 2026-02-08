import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class ExpenseSchedulerService {
  private readonly logger = new Logger(ExpenseSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async processRecurringExpenses(): Promise<void> {
    this.logger.log('Processing recurring expenses...');

    const recurringExpenses = await this.prisma.expense.findMany({
      where: {
        isRecurring: true,
        recurringFrequency: { not: null },
      },
    });

    let created = 0;
    let skipped = 0;

    for (const expense of recurringExpenses) {
      try {
        // Skip if past recurring end date
        if (expense.recurringEndDate && new Date() > expense.recurringEndDate) {
          skipped++;
          continue;
        }

        const nextDueDate = this.computeNextDueDate(
          expense.createdAt,
          expense.recurringFrequency,
        );

        if (!nextDueDate || nextDueDate > new Date()) {
          skipped++;
          continue;
        }

        // Check if an expense was already created for this period
        const existingForPeriod = await this.prisma.expense.findFirst({
          where: {
            restaurantId: expense.restaurantId,
            title: expense.title,
            categoryId: expense.categoryId,
            expenseDate: {
              gte: this.getPeriodStart(nextDueDate, expense.recurringFrequency),
              lte: nextDueDate,
            },
            id: { not: expense.id },
          },
        });

        if (existingForPeriod) {
          skipped++;
          continue;
        }

        // Create a new expense clone
        await this.prisma.expense.create({
          data: {
            restaurantId: expense.restaurantId,
            categoryId: expense.categoryId,
            title: expense.title,
            description: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            expenseDate: nextDueDate,
            paymentMethod: expense.paymentMethod,
            vendorName: expense.vendorName,
            vendorContact: expense.vendorContact,
            receiptUrl: expense.receiptUrl,
            taxAmount: expense.taxAmount,
            taxPercentage: expense.taxPercentage,
            isRecurring: false, // Clone is not itself recurring
            tags: expense.tags,
            notes: `Auto-generated from recurring expense`,
            status: 'pending',
            createdBy: expense.createdBy,
          },
        });

        created++;
      } catch (error) {
        this.logger.error(
          `Failed to process recurring expense ${expense.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Recurring expenses processed: ${created} created, ${skipped} skipped`,
    );
  }

  private computeNextDueDate(createdAt: Date, frequency: string): Date | null {
    const now = new Date();
    const date = new Date(createdAt);

    switch (frequency) {
      case 'daily':
        while (date <= now) date.setDate(date.getDate() + 1);
        // Return the most recent past due date (within last day)
        date.setDate(date.getDate() - 1);
        return date;

      case 'weekly':
        while (date <= now) date.setDate(date.getDate() + 7);
        date.setDate(date.getDate() - 7);
        return date;

      case 'monthly':
        while (date <= now) date.setMonth(date.getMonth() + 1);
        date.setMonth(date.getMonth() - 1);
        return date;

      case 'yearly':
        while (date <= now) date.setFullYear(date.getFullYear() + 1);
        date.setFullYear(date.getFullYear() - 1);
        return date;

      default:
        return null;
    }
  }

  private getPeriodStart(dueDate: Date, frequency: string): Date {
    const start = new Date(dueDate);

    switch (frequency) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'yearly':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return start;
  }
}
