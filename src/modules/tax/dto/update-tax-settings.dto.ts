import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { TaxRegime } from '../interfaces';

class GstConfigDto {
  @IsOptional()
  @IsBoolean()
  compositionScheme?: boolean;

  @IsOptional()
  @IsString()
  placeOfSupply?: string;

  @IsOptional()
  @IsBoolean()
  eInvoiceEnabled?: boolean;
}

class VatConfigDto {
  @IsOptional()
  @IsBoolean()
  reverseChargeApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  ossRegistered?: boolean;
}

class SalesTaxConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nexusStates?: string[];

  @IsOptional()
  @IsString()
  taxExemptionId?: string;
}

export class UpdateTaxSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  regime?: TaxRegime;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  regionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  regionName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultTaxRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  invoicePrefix?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  financialYearStart?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GstConfigDto)
  gstConfig?: GstConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => VatConfigDto)
  vatConfig?: VatConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SalesTaxConfigDto)
  salesTaxConfig?: SalesTaxConfigDto;
}

export class ValidateRegistrationDto {
  @IsString()
  regime: TaxRegime;

  @IsString()
  @MaxLength(50)
  registrationNumber: string;
}
