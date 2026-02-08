import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class SanitizationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.body && typeof request.body === 'object') {
      request.body = this.sanitize(request.body);
    }

    return next.handle();
  }

  private sanitize(obj: any): any {
    if (typeof obj === 'string') {
      return obj.replace(/<[^>]*>/g, '');
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitize(value);
      }
      return sanitized;
    }

    return obj;
  }
}
