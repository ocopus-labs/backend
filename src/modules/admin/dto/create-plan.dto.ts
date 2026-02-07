import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsBoolean,
  IsObject,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsString()
  @MaxLength(100)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(999999.99)
  priceMonthly: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  priceYearly?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string = 'INR';

  @IsInt()
  maxLocations: number;

  @IsInt()
  maxTeamMembers: number;

  @IsInt()
  maxOrdersPerMonth: number;

  @IsObject()
  features: Record<string, boolean>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dodoProductId?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
