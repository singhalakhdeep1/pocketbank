import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/infra.js';
import { httpDuration } from '../metrics.js';
import { StructuredLoggingService } from '../services/structured-logging/structured-logging.service.js';

/** Correlation ID + device context for every request, request logging and latency metrics. */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-correlation-id');
  const correlationId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : StructuredLoggingService.createCorrelationId();
  res.setHeader('x-correlation-id', correlationId);
  const started = process.hrtime.bigint();
  logger.runWithContext(
    {
      correlationId,
      deviceId: req.header('x-device-id') ?? undefined,
      platform: req.header('x-platform') ?? undefined,
      ip: req.ip,
    },
    () => {
      res.on('finish', () => {
        const seconds = Number(process.hrtime.bigint() - started) / 1e9;
        const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
        httpDuration.observe({ method: req.method, route, status: String(res.statusCode) }, seconds);
        if (req.path !== '/health' && req.path !== '/metrics') {
          logger.logInformation('HTTP request', {
            method: req.method,
            path: req.originalUrl.split('?')[0],
            status: res.statusCode,
            durationMs: Math.round(seconds * 1000),
          });
        }
      });
      next();
    },
  );
}
