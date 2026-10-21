import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { conflict } from '../lib/errors.js';
import { prisma } from '../lib/infra.js';

const PENDING = 0;
const STALE_PENDING_MS = 60_000;

/**
 * Idempotency-Key support for money-moving POSTs: a retried request with the same key returns the
 * stored response instead of moving money twice. The key is reserved before the handler runs, so
 * concurrent or fast retries can never execute the handler a second time.
 */
export async function idempotent(req: Request, res: Response, next: NextFunction) {
  const key = req.header('idempotency-key');
  if (!key || !req.user) return next();
  if (!/^[\w-]{8,100}$/.test(key)) return next(conflict('Invalid Idempotency-Key'));
  const scoped = `${req.user.id}:${key}`;
  const user = req.user;

  const reserve = () =>
    prisma.idempotencyKey.create({ data: { key: scoped, userId: user.id, method: req.method, path: req.originalUrl, statusCode: PENDING, response: {} } });

  try {
    await reserve();
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) return next(err);
    const existing = await prisma.idempotencyKey.findUnique({ where: { key: scoped } });
    if (!existing) return next(conflict('A request with this Idempotency-Key is still in progress'));
    if (existing.path !== req.originalUrl || existing.method !== req.method) {
      return next(conflict('Idempotency-Key was already used for a different request'));
    }
    if (existing.statusCode !== PENDING) {
      res.setHeader('Idempotent-Replayed', 'true');
      return res.status(existing.statusCode).json(existing.response);
    }
    // A reservation left behind by a crashed process is released so the client can retry.
    if (Date.now() - existing.createdAt.getTime() < STALE_PENDING_MS) {
      return next(conflict('A request with this Idempotency-Key is still in progress'));
    }
    const released = await prisma.idempotencyKey.deleteMany({ where: { key: scoped, statusCode: PENDING, createdAt: existing.createdAt } });
    if (released.count === 0) return next(conflict('A request with this Idempotency-Key is still in progress'));
    try {
      await reserve();
    } catch {
      return next(conflict('A request with this Idempotency-Key is still in progress'));
    }
  }

  const originalJson = res.json.bind(res);
  res.json = (payload: unknown) => {
    // Server errors free the key so the client may retry; anything else is stored for replay.
    const settle =
      res.statusCode < 500
        ? prisma.idempotencyKey.update({ where: { key: scoped }, data: { statusCode: res.statusCode, response: (payload ?? {}) as object } })
        : prisma.idempotencyKey.delete({ where: { key: scoped } });
    settle.catch(() => undefined).finally(() => originalJson(payload));
    return res;
  };
  next();
}
