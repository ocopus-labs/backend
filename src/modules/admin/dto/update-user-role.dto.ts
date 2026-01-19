import { IsString, IsIn } from 'class-validator';
import { USER_ROLES } from 'src/lib/auth/roles.constants';

export class UpdateUserRoleDto {
  @IsString()
  @IsIn(Object.values(USER_ROLES))
  role: string;
}
