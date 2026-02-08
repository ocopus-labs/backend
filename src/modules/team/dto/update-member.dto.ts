import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
} from 'class-validator';
import { ASSIGNABLE_ROLES, TEAM_MEMBER_STATUSES, AssignableRole, TeamMemberStatus } from '../interfaces';

export class UpdateTeamMemberDto {
  @IsEnum(ASSIGNABLE_ROLES)
  @IsOptional()
  role?: AssignableRole;

  @IsEnum(Object.values(TEAM_MEMBER_STATUSES))
  @IsOptional()
  status?: TeamMemberStatus;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class UpdateMemberRoleDto {
  @IsEnum(ASSIGNABLE_ROLES)
  role: AssignableRole;
}

export class UpdateMemberPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class SuspendMemberDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
