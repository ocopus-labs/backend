import { Module } from '@nestjs/common';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';
import { ExpenseSchedulerService } from './expense-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [PrismaModule, BusinessModule],
  controllers: [ExpenseController],
  providers: [ExpenseService, ExpenseSchedulerService],
  exports: [ExpenseService],
})
export class ExpenseModule {}
