import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { SanitizationInterceptor } from '../interceptors/sanitization.interceptor';

/**
 * Apply input sanitization (HTML tag stripping) to this endpoint's request body.
 * Use on POST/PUT/PATCH handlers that accept user-provided text input.
 */
export const Sanitize = () =>
  applyDecorators(UseInterceptors(SanitizationInterceptor));
