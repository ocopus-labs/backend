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
