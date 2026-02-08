import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemModifierDto {
  @IsString()
  id: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(0)
  @Max(100000)
  price: number;
}

class ItemModifiersDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderItemModifierDto)
  size?: OrderItemModifierDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderItemModifierDto)
  spiceLevel?: OrderItemModifierDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  preparation?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemModifierDto)
  @ArrayMaxSize(20)
  addOns?: OrderItemModifierDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  removals?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string;
}

class CustomerOrderItemDto {
  @IsString()
  menuItemId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsNumber()
  @Min(1)
  @Max(50)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Max(100000)
  basePrice: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ItemModifiersDto)
  modifiers?: ItemModifiersDto;
}

export class CustomerPlaceOrderDto {
  @IsString()
  @MaxLength(20)
  tableNumber: string;

  @IsString()
  @MaxLength(255)
  customerName: string;

  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[\d\s-]+$/, { message: 'Invalid phone number format' })
  customerPhone: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CustomerOrderItemDto)
  items: CustomerOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string;
}

export class CustomerPaymentDto {
  @IsNumber()
  @Min(0.01)
  @Max(500000)
  amount: number;

  @IsString()
  @MaxLength(50)
  method: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionReference?: string;
}

export class UpdateOrderingSettingsDto {
  @IsOptional()
  @IsBoolean()
  selfOrderEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  requirePrepayment?: boolean;
}

export class GenerateCustomerPaymentQrDto {
  @IsNumber()
  @Min(0.01)
  @Max(500000)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class CreatePaymentCheckoutDto {
  @IsString()
  @MaxLength(2048)
  returnUrl: string;
}
