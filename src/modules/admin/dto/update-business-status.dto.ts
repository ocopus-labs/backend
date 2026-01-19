import { IsString, IsIn } from 'class-validator';

export class UpdateBusinessStatusDto {
  @IsString()
  @IsIn(['active', 'suspended', 'inactive', 'deleted'])
  status: string;
}
