import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/infra.js';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const correlationId = logger.getContext()?.correlationId;
  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details, correlationId } });
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details, correlationId } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Already exists', correlationId } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found', correlationId } });
  }
  const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 500;
  if (status >= 500) logger.logError('Unhandled error', err);
  res.status(status).json({
    error: {
      code: status >= 500 ? 'INTERNAL' : 'BAD_REQUEST',
      message: status >= 500 ? 'Internal server error' : (err as Error).message,
      correlationId,
    },
  });
}
