import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsObject,
  ValidateNested,
  ValidateIf,
  MinLength,
  MaxLength,
  IsUrl,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BUSINESS_TYPES, BusinessType } from '../config/business-types.config';

class AddressDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  street?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;
}

class ContactDto {
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsUrl()
  @IsOptional()
  @MaxLength(500)
  website?: string;
}

class SettingsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  timezone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currency: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  taxRate?: string;
}

export class CreateBusinessDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEnum(Object.values(BUSINESS_TYPES))
  type: BusinessType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @ValidateIf((o) => o.logo && !o.logo.startsWith('data:'))
  @IsUrl({}, { message: 'logo must be a valid URL' })
  logo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  subType?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;

  @IsObject()
  @ValidateNested()
  @Type(() => SettingsDto)
  settings: SettingsDto;
}
