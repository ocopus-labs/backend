import {
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  MaxLength,
  ArrayMinSize,
  IsIn,
} from 'class-validator';
import { VALID_SCOPES, VALID_PERMISSIONS } from '../interfaces';

export class CreateApiKeyDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(VALID_SCOPES as unknown as string[], { each: true })
  scopes: string[];

  @IsArray()
  @IsIn(VALID_PERMISSIONS as unknown as string[], { each: true })
  permissions: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
