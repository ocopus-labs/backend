import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PaymentMethod } from '../interfaces';

class CustomerInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;
}

class BillingAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}

export class CreatePaymentDto {
  @IsString()
  orderId: string;

  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  amount: number;

  @IsEnum(['cash', 'card', 'upi', 'net_banking', 'wallet', 'other'])
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customerInfo?: CustomerInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress?: BillingAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionReference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  tipAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  cashReceived?: number;
}

class SplitPaymentItemDto {
  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  amount: number;

  @IsEnum(['cash', 'card', 'upi', 'net_banking', 'wallet', 'other'])
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionReference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  cashReceived?: number;
}

export class CreateSplitPaymentDto {
  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitPaymentItemDto)
  payments: SplitPaymentItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customerInfo?: CustomerInfoDto;
}

export class ProcessRefundDto {
  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsEnum(['cash', 'card', 'upi', 'net_banking', 'wallet', 'other'])
  refundMethod: PaymentMethod;
}

export class UpdatePaymentStatusDto {
  @IsEnum(['pending', 'completed', 'failed', 'refunded', 'partially_refunded'])
  status:
    | 'pending'
    | 'completed'
    | 'failed'
    | 'refunded'
    | 'partially_refunded';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  failureReason?: string;
}
