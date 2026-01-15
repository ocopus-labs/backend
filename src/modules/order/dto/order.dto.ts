import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  ValidateNested,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { OrderType, OrderPriority } from '../interfaces';

class CustomerAddressDto {
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
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerAddressDto)
  address?: CustomerAddressDto;
}

class OrderItemModifierDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
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
  preparation?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemModifierDto)
  addOns?: OrderItemModifierDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  removals?: string[];

  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

class OrderItemDto {
  @IsString()
  menuItemId: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ItemModifiersDto)
  modifiers?: ItemModifiersDto;
}

class DiscountDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsEnum(['percentage', 'fixed'])
  type: 'percentage' | 'fixed';

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateOrderDto {
  @IsEnum(['dine_in', 'takeaway', 'delivery', 'online'])
  orderType: OrderType;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  tableNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customerInfo?: CustomerInfoDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceCharge?: number;

  @IsOptional()
  @IsEnum(['low', 'normal', 'high', 'urgent'])
  priority?: OrderPriority;

  @IsOptional()
  @IsNumber()
  estimatedMinutes?: number;
}

export class UpdateOrderItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class UpdateOrderItemStatusDto {
  @IsString()
  itemId: string;

  @IsEnum(['pending', 'preparing', 'ready', 'served', 'cancelled'])
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

export class UpdateOrderStatusDto {
  @IsEnum(['active', 'completed', 'cancelled', 'refunded'])
  status: 'active' | 'completed' | 'cancelled' | 'refunded';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApplyDiscountDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsEnum(['percentage', 'fixed'])
  type: 'percentage' | 'fixed';

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AddItemsToOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class RemoveItemFromOrderDto {
  @IsString()
  itemId: string;
}

export class UpdateItemQuantityDto {
  @IsString()
  itemId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}
