import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateBusinessDto } from './create-business.dto';

export enum BusinessStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {
  @IsEnum(BusinessStatus)
  @IsOptional()
  status?: BusinessStatus;
}
