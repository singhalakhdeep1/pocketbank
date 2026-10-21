import type { NextFunction, Request, Response } from 'express';
import { conflict } from '../lib/errors.js';
import { prisma } from '../lib/infra.js';

/**
 * Idempotency-Key support for money-moving POSTs: a retried request with the same key returns the
 * stored response instead of moving money twice.
 */
export async function idempotent(req: Request, res: Response, next: NextFunction) {
  const key = req.header('idempotency-key');
  if (!key || !req.user) return next();
  if (!/^[\w-]{8,100}$/.test(key)) return next(conflict('Invalid Idempotency-Key'));
  const scoped = `${req.user.id}:${key}`;
  const existing = await prisma.idempotencyKey.findUnique({ where: { key: scoped } });
  if (existing) {
    if (existing.path !== req.originalUrl || existing.method !== req.method) {
      return next(conflict('Idempotency-Key was already used for a different request'));
    }
    res.setHeader('Idempotent-Replayed', 'true');
    return res.status(existing.statusCode).json(existing.response);
  }
  const user = req.user;
  const originalJson = res.json.bind(res);
  res.json = (payload: unknown) => {
    if (res.statusCode < 500) {
      prisma.idempotencyKey
        .create({
          data: {
            key: scoped,
            userId: user.id,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            response: payload as object,
          },
        })
        .catch(() => undefined);
    }
    return originalJson(payload);
  };
  next();
}
