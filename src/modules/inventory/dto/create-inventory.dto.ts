import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDate,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { INVENTORY_CATEGORIES, INVENTORY_UNITS, InventoryCategory, InventoryUnit } from '../interfaces';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sku: string;

  @IsEnum(INVENTORY_CATEGORIES)
  category: InventoryCategory;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentStock: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minimumStock: number;

  @IsEnum(INVENTORY_UNITS)
  unit: InventoryUnit;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPerUnit: number;

  @IsBoolean()
  @IsOptional()
  trackExpiry?: boolean;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  expiryDate?: Date;
}
