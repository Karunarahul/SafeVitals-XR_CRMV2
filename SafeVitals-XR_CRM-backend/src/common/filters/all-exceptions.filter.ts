import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request as any).correlationId ||
      '';

    const isProduction = process.env.NODE_ENV === 'production';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    let message = 'Internal server error';
    let errorDetails: any = null;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      message = (exceptionResponse as any).message || message;
      errorDetails = (exceptionResponse as any).error || null;
    } else if (exception instanceof Error) {
      message =
        isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'An internal server error occurred'
          : exception.message;
    }

    // In production, never leak internal 500 error details or stack traces
    if (isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      errorDetails = null;
      message = 'An internal server error occurred. Please contact system support.';
    }

    // Structured logging for operational auditability
    const logData = {
      type: 'EXCEPTION',
      correlationId,
      method: request.method,
      path: request.url,
      statusCode: status,
      clientIp: request.ip || request.headers['x-forwarded-for'] || '',
      message: typeof message === 'object' ? JSON.stringify(message) : message,
    };

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          ...logData,
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      );
    } else {
      this.logger.warn(JSON.stringify(logData));
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId: correlationId || undefined,
      message,
      ...(errorDetails && !isProduction ? { error: errorDetails } : {}),
    });
  }
}
