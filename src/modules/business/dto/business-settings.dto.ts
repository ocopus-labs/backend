import { IsString, IsNotEmpty, IsOptional, IsObject, IsUrl, ValidateIf } from 'class-validator';

export class UpdateBusinessSettingsDto {
  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  taxRate?: string;

  @IsObject()
  @IsOptional()
  businessHours?: Record<string, { open: string; close: string; isClosed?: boolean }>;

  @IsObject()
  @IsOptional()
  features?: string[];
}

export class UpdateBusinessLogoDto {
  @IsNotEmpty()
  @ValidateIf((o) => o.logo && !o.logo.startsWith('data:'))
  @IsUrl({}, { message: 'logo must be a valid URL' })
  logo: string;
}
