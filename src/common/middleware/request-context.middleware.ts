import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requestContext } from '@common/context/request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // prefer X-Forwarded-For (set by a reverse proxy) over the socket's
    // address, which is all `req.ip` gives us when running behind one
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
        ?.split(',')[0]
        ?.trim() ??
      req.ip ??
      null;

    requestContext.run(
      { ip, userAgent: req.headers['user-agent'] ?? null },
      () => next(),
    );
  }
}
