// Re-export decorators from nestjs-better-auth
export {
  AllowAnonymous,
  OptionalAuth,
  Session,
  Roles as BetterAuthRoles,
  Hook,
  BeforeHook,
  AfterHook,
} from '@thallesp/nestjs-better-auth';

// Export custom decorators
export { Roles, ROLES_KEY } from './roles.decorator';
export { BusinessRoles, BUSINESS_ROLES_KEY } from './business-roles.decorator';
export { RequirePermission, PERMISSION_KEY } from './require-permission.decorator';
export { Sanitize } from './sanitize.decorator';
