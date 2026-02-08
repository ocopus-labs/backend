import {
  IsString,
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
import {
  TABLE_SHAPES,
  TableShape,
  TableStatus,
  TABLE_STATUSES,
} from '../interfaces';

class PositionDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  x?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  y?: number;

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
  @IsOptional()
  width?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  height?: number;
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

export class UpdateTableDto {
  @IsString()
  @IsOptional()
  tableNumber?: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  capacity?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => PositionDto)
  @IsOptional()
  position?: PositionDto;

  @IsEnum(TABLE_SHAPES)
  @IsOptional()
  shape?: TableShape;

  @IsObject()
  @ValidateNested()
  @Type(() => DimensionsDto)
  @IsOptional()
  dimensions?: DimensionsDto;

  @IsEnum(Object.values(TABLE_STATUSES))
  @IsOptional()
  status?: TableStatus;

  @IsObject()
  @ValidateNested()
  @Type(() => SettingsDto)
  @IsOptional()
  settings?: SettingsDto;
}
