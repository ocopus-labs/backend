import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TierThresholdsDto {
  @IsNumber()
  @Min(1)
  silver: number;

  @IsNumber()
  @Min(1)
  gold: number;

  @IsNumber()
  @Min(1)
  platinum: number;
}

class TierMultipliersDto {
  @IsNumber()
  @Min(1)
  bronze: number;

  @IsNumber()
  @Min(1)
  silver: number;

  @IsNumber()
  @Min(1)
  gold: number;

  @IsNumber()
  @Min(1)
  platinum: number;
}

export class UpdateLoyaltySettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  redemptionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumRedemption?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TierThresholdsDto)
  tiers?: TierThresholdsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TierMultipliersDto)
  tierMultipliers?: TierMultipliersDto;
}
