import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUrl,
  ValidateIf,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @ValidateIf((o) => o.image && !o.image.startsWith('data:'))
  @IsUrl({}, { message: 'image must be a valid URL' })
  image?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @ValidateIf((o) => o.image && !o.image.startsWith('data:'))
  @IsUrl({}, { message: 'image must be a valid URL' })
  image?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ReorderCategoriesDto {
  @IsString({ each: true })
  categoryIds: string[];
}
