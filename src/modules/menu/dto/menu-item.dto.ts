import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MenuItemModifierDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsNumber()
  sortOrder: number;
}

export class MenuItemModifiersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemModifierDto)
  @IsOptional()
  sizes?: MenuItemModifierDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemModifierDto)
  @IsOptional()
  spiceLevels?: MenuItemModifierDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preparation?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemModifierDto)
  @IsOptional()
  addOns?: MenuItemModifierDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  removals?: string[];
}

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  isVegetarian?: boolean;

  @IsBoolean()
  @IsOptional()
  isVegan?: boolean;

  @IsBoolean()
  @IsOptional()
  isGlutenFree?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  preparationTime?: number;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ValidateNested()
  @Type(() => MenuItemModifiersDto)
  @IsOptional()
  modifiers?: MenuItemModifiersDto;
}

export class UpdateMenuItemDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  isVegetarian?: boolean;

  @IsBoolean()
  @IsOptional()
  isVegan?: boolean;

  @IsBoolean()
  @IsOptional()
  isGlutenFree?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  preparationTime?: number;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ValidateNested()
  @Type(() => MenuItemModifiersDto)
  @IsOptional()
  modifiers?: MenuItemModifiersDto;
}
