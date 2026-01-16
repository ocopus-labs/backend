import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDate,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  INVENTORY_STATUSES,
  InventoryCategory,
  InventoryUnit,
  InventoryStatus,
} from '../interfaces';

export class UpdateInventoryItemDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  sku?: string;

  @IsEnum(INVENTORY_CATEGORIES)
  @IsOptional()
  category?: InventoryCategory;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minimumStock?: number;

  @IsEnum(INVENTORY_UNITS)
  @IsOptional()
  unit?: InventoryUnit;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  costPerUnit?: number;

  @IsBoolean()
  @IsOptional()
  trackExpiry?: boolean;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  expiryDate?: Date;

  @IsEnum(Object.values(INVENTORY_STATUSES))
  @IsOptional()
  status?: InventoryStatus;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
