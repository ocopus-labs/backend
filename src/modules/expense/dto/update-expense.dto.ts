import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDate,
  IsArray,
  Min,
  MaxLength,
  IsUrl,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
  EXPENSE_STATUSES,
  PaymentMethod,
  RecurringFrequency,
  ExpenseStatus,
} from '../interfaces';

export class UpdateExpenseDto {
  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  @IsOptional()
  amount?: number;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expenseDate?: Date;

  @IsEnum(PAYMENT_METHODS)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  vendorName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  vendorContact?: string;

  @IsUrl()
  @IsOptional()
  receiptUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  receiptNumber?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  taxAmount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  taxPercentage?: number;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsEnum(Object.values(RECURRING_FREQUENCIES))
  @IsOptional()
  recurringFrequency?: RecurringFrequency;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  recurringEndDate?: Date;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

export class ApproveExpenseDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectExpenseDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class MarkAsPaidDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
