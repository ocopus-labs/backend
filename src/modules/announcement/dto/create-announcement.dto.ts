import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsIn,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical', 'maintenance'])
  type?: string = 'info';

  @IsOptional()
  @IsIn(['all', 'business_owners', 'staff', 'specific_plan'])
  target?: string = 'all';

  @IsOptional()
  @IsObject()
  targetMeta?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
