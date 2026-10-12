import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const { method, url } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse();
          const statusCode = res.statusCode;
          const delay = Date.now() - now;
          this.logger.log(`[${method}] ${url} ${statusCode} - ${delay}ms`);
        },
        error: (err) => {
          const delay = Date.now() - now;
          this.logger.warn(`[${method}] ${url} failed after ${delay}ms: ${err.message}`);
        },
      }),
    );
  }
}
