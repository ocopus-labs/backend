import { SetMetadata } from '@nestjs/common';

export const BUSINESS_ROLES_KEY = 'businessRoles';
export const BusinessRoles = (...roles: string[]) =>
  SetMetadata(BUSINESS_ROLES_KEY, roles);
