import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsObject,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TABLE_SHAPES, TableShape } from '../interfaces';

class PositionDto {
  @IsInt()
  @Min(0)
  x: number;

  @IsInt()
  @Min(0)
  y: number;

  @IsString()
  @IsOptional()
  floor?: string;

  @IsString()
  @IsOptional()
  section?: string;
}

class DimensionsDto {
  @IsInt()
  @Min(1)
  width: number;

  @IsInt()
  @Min(1)
  height: number;
}

class SettingsDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  minPartySize?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxPartySize?: number;

  @IsBoolean()
  @IsOptional()
  isReservable?: boolean;

  @IsInt()
  @IsOptional()
  @Min(15)
  defaultTurnoverTime?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateTableDto {
  @IsString()
  @IsNotEmpty()
  tableNumber: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsInt()
  @Min(1)
  @Max(20)
  capacity: number;

  @IsObject()
  @ValidateNested()
  @Type(() => PositionDto)
  position: PositionDto;

  @IsEnum(TABLE_SHAPES)
  @IsOptional()
  shape?: TableShape;

  @IsObject()
  @ValidateNested()
  @Type(() => DimensionsDto)
  @IsOptional()
  dimensions?: DimensionsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => SettingsDto)
  @IsOptional()
  settings?: SettingsDto;
}
