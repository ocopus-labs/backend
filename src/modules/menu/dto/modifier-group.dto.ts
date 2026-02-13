import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ModifierGroupOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class CreateModifierGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsBoolean()
  @IsOptional()
  multiSelect?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minSelections?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxSelections?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierGroupOptionDto)
  @ArrayMinSize(1)
  options: ModifierGroupOptionDto[];

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateModifierGroupDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsBoolean()
  @IsOptional()
  multiSelect?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minSelections?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxSelections?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierGroupOptionDto)
  @ArrayMinSize(1)
  @IsOptional()
  options?: ModifierGroupOptionDto[];

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
