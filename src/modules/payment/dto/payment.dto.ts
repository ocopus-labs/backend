import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PaymentMethod } from '../interfaces';

class CustomerInfoDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;
}

class BillingAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class CreatePaymentDto {
  @IsString()
  orderId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(['cash', 'card', 'upi', 'net_banking', 'wallet', 'other'])
  method: PaymentMethod;

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
  transactionReference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cashReceived?: number;
}

class SplitPaymentItemDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(['cash', 'card', 'upi', 'net_banking', 'wallet', 'other'])
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  transactionReference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cashReceived?: number;
}

export class CreateSplitPaymentDto {
  @IsString()
  orderId: string;

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
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsEnum(['cash', 'card', 'upi', 'net_banking', 'wallet', 'other'])
  refundMethod: PaymentMethod;
}

export class UpdatePaymentStatusDto {
  @IsEnum(['pending', 'completed', 'failed', 'refunded', 'partially_refunded'])
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';

  @IsOptional()
  @IsString()
  transactionReference?: string;

  @IsOptional()
  @IsString()
  failureReason?: string;
}
