import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import { logger, rateLimiter } from '../lib/infra.js';
import { rateLimited } from '../metrics.js';
import type { BucketOptions } from '../services/rate-limiting/rate-limiting.service.js';

/** Token-bucket limiter keyed by user (when authenticated) or client IP. */
export function rateLimit(bucket: string, options?: BucketOptions, cost = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identity = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    try {
      const result = await rateLimiter.take(`${bucket}:${identity}`, cost, options);
      res.setHeader('RateLimit-Limit', String(result.limit));
      res.setHeader('RateLimit-Remaining', String(result.remaining));
      if (!result.allowed) {
        rateLimited.inc({ bucket });
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
        logger.logWarning('Rate limit exceeded', { bucket, identity });
        return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests, slow down'));
      }
      next();
    } catch (err) {
      // Fail open: a cache outage must not take banking down; it is logged instead.
      logger.logError('Rate limiter unavailable', err, { bucket });
      next();
    }
  };
}
