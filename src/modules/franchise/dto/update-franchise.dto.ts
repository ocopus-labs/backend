import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsObject,
  IsIn,
} from 'class-validator';

export class UpdateFranchiseDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: string;

  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  branding?: Record<string, unknown>;
}
