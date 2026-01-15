import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

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
  @IsString()
  @IsNotEmpty()
  logo: string;
}
