import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ASSIGNABLE_ROLES, AssignableRole } from '../interfaces';

export class InviteTeamMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(ASSIGNABLE_ROLES)
  role: AssignableRole;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  customPermissions?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(500)
  message?: string;
}

export class AddExistingUserDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(ASSIGNABLE_ROLES)
  role: AssignableRole;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  customPermissions?: string[];
}
