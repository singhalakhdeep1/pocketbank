import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { logger } from '../lib/infra.js';

export interface AuthUser {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ email: user.email, role: user.role, typ: 'access' }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.accessTokenTtl as jwt.SignOptions['expiresIn'],
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
    if (payload.typ !== 'access' || !payload.sub) return next(unauthorized('Invalid token'));
    req.user = { id: payload.sub, email: String(payload.email), role: payload.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER' };
    logger.enrichContext({ userId: payload.sub });
    next();
  } catch (err) {
    next(unauthorized(err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token'));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return next(forbidden('Admin only'));
  next();
}

export const userId = (req: Request) => {
  if (!req.user) throw unauthorized();
  return req.user.id;
};
