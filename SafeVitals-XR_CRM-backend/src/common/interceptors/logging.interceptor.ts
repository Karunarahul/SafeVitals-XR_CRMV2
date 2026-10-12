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
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req as any).correlationId ||
      '';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse();
          const statusCode = res.statusCode;
          const delay = Date.now() - now;
          this.logger.log(
            JSON.stringify({
              type: 'REQUEST_COMPLETED',
              correlationId,
              method,
              url,
              statusCode,
              durationMs: delay,
              clientIp: req.ip || req.headers['x-forwarded-for'] || '',
            }),
          );
        },
        error: (err) => {
          const delay = Date.now() - now;
          this.logger.warn(
            JSON.stringify({
              type: 'REQUEST_FAILED',
              correlationId,
              method,
              url,
              statusCode: err.status || 500,
              durationMs: delay,
              errorMessage: err.message,
            }),
          );
        },
      }),
    );
  }
}
