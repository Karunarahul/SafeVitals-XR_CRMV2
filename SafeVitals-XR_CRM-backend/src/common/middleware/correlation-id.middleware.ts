import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      `req_${crypto.randomBytes(12).toString('hex')}`;

    req.headers['x-correlation-id'] = correlationId;
    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}
