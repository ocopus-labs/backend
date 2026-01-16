import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDate,
  IsArray,
  Min,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PAYMENT_METHODS, RECURRING_FREQUENCIES, PaymentMethod, RecurringFrequency } from '../interfaces';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsDate()
  @Type(() => Date)
  expenseDate: Date;

  @IsEnum(PAYMENT_METHODS)
  paymentMethod: PaymentMethod;

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
