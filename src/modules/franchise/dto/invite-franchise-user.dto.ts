import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsIn,
  IsArray,
} from 'class-validator';

export class InviteFranchiseUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['franchise_owner', 'manager', 'viewer'])
  role: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class UpdateFranchiseUserDto {
  @IsString()
  @IsOptional()
  @IsIn(['franchise_owner', 'manager', 'viewer'])
  role?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
