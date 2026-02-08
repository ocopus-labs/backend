import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';

export const HTTP_CACHE_TTL_KEY = 'http-cache-ttl';

/**
 * Decorator to set Cache-Control max-age on a route handler.
 * @param seconds Cache duration in seconds (e.g. 300 = 5 minutes)
 */
export const HttpCacheTTL = (seconds: number) =>
  SetMetadata(HTTP_CACHE_TTL_KEY, seconds);

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ttl = this.reflector.get<number>(
      HTTP_CACHE_TTL_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      tap(() => {
        if (ttl && ttl > 0) {
          const response = context.switchToHttp().getResponse();
          response.setHeader(
            'Cache-Control',
            `public, max-age=${ttl}, stale-while-revalidate=${Math.floor(ttl / 2)}`,
          );
        }
      }),
    );
  }
}
