import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
