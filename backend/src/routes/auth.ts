import bcrypt from 'bcryptjs';
import { Router, type Request } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import type { User } from '../generated/prisma/client.js';
import { badRequest, conflict, unauthorized, ApiError } from '../lib/errors.js';
import { logger, prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { decrypt, encrypt, newTotpSecret, randomToken, sha256, verifyTotp } from '../lib/security.js';
import { authEvents } from '../metrics.js';
import { requireAuth, signAccessToken, userId } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { body } from '../middleware/validate.js';
import { notify } from '../services/notification.service.js';
import { newAccountNumber } from './helpers.js';

export const authRouter = Router();

const authBucket = { capacity: config.rateLimit.authCapacity, refillPerSecond: config.rateLimit.authRefillPerSecond };
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a number');

async function issueTokens(user: User, device?: string | null, family?: string) {
  const refreshToken = randomToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      family: family ?? randomToken(12),
      device: device ?? null,
      expiresAt: new Date(Date.now() + config.refreshTokenDays * 86_400_000),
    },
  });
  return {
    accessToken: signAccessToken({ id: user.id, email: user.email, role: user.role }),
    refreshToken,
    tokenType: 'Bearer',
    user: serialize.user(user),
  };
}

let dummyHash: string | undefined;

const device = (req: Request) => req.header('x-device-id') ?? req.header('user-agent')?.slice(0, 120) ?? null;

authRouter.post('/register', rateLimit('auth', authBucket), async (req, res) => {
  const input = body(
    req,
    z.object({
      email: z.string().trim().toLowerCase().pipe(z.email()),
      password,
      firstName: z.string().trim().min(1).max(60),
      lastName: z.string().trim().min(1).max(60),
      phone: z.string().trim().max(30).optional().or(z.literal('')),
    }),
  );
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict('An account with this email already exists');
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
    },
  });
  // Every customer starts with a checking and a savings account.
  await prisma.account.create({ data: { userId: user.id, type: 'CHECKING', accountNumber: await newAccountNumber() } });
  await prisma.account.create({
    data: { userId: user.id, type: 'SAVINGS', accountNumber: await newAccountNumber(), interestRate: config.savingsApy },
  });
  authEvents.inc({ event: 'register' });
  logger.logAuditEvent('UserRegistered', 'New customer registered', { userId: user.id });
  res.status(201).json(await issueTokens(user, device(req)));
});

async function completeLogin(user: User, req: Request) {
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  authEvents.inc({ event: 'login' });
  logger.logAuditEvent('UserLoggedIn', 'Customer signed in', { userId: user.id, device: device(req) });
  void notify(user.id, 'security', 'New sign-in', `Signed in from ${req.header('x-platform') ?? 'a device'} at ${new Date().toUTCString()}`);
  return issueTokens(user, device(req));
}

async function registerFailure(user: User) {
  const failed = user.failedLogins + 1;
  const lock = failed >= 5;
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + 15 * 60_000) : user.lockedUntil },
  });
  authEvents.inc({ event: lock ? 'locked' : 'failed' });
  if (lock) {
    logger.logAuditEvent('AccountLocked', 'Too many failed sign-in attempts', { userId: user.id });
    void notify(user.id, 'security', 'Account temporarily locked', 'We locked sign-in for 15 minutes after 5 failed attempts.');
  }
}

authRouter.post('/login', rateLimit('auth', authBucket), async (req, res) => {
  const input = body(req, z.object({ email: z.string().trim().toLowerCase(), password: z.string().min(1) }));
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    // Same bcrypt cost for unknown emails, so response time does not reveal which emails exist.
    dummyHash ??= await bcrypt.hash('not-a-real-password', 12);
    await bcrypt.compare(input.password, dummyHash);
    authEvents.inc({ event: 'failed' });
    throw unauthorized('Invalid email or password');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(423, 'LOCKED', 'Too many failed attempts. Try again in a few minutes.');
  }
  if (!(await bcrypt.compare(input.password, user.passwordHash))) {
    await registerFailure(user);
    throw unauthorized('Invalid email or password');
  }
  if (user.twoFactorEnabled) {
    const challengeToken = jwt.sign({ typ: 'mfa' }, config.jwtSecret, { subject: user.id, expiresIn: '5m' });
    return res.json({ twoFactorRequired: true, challengeToken });
  }
  res.json(await completeLogin(user, req));
});

authRouter.post('/login/2fa', rateLimit('auth', authBucket), async (req, res) => {
  const input = body(req, z.object({ challengeToken: z.string(), code: z.string().trim() }));
  let sub: string;
  try {
    const payload = jwt.verify(input.challengeToken, config.jwtSecret) as jwt.JwtPayload;
    if (payload.typ !== 'mfa' || !payload.sub) throw new Error('bad type');
    sub = payload.sub;
  } catch {
    throw unauthorized('Sign-in challenge expired, start again');
  }
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user?.twoFactorSecret) throw unauthorized();
  if (!verifyTotp(decrypt(user.twoFactorSecret), input.code)) {
    await registerFailure(user);
    throw unauthorized('Invalid verification code');
  }
  res.json(await completeLogin(user, req));
});

authRouter.post('/refresh', rateLimit('refresh'), async (req, res) => {
  const token = String(req.body?.refreshToken ?? req.query.refreshToken ?? '');
  if (!token) throw badRequest('refreshToken is required');
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!stored) throw unauthorized('Invalid refresh token');
  if (stored.revokedAt) {
    // A rotated token was presented again: assume theft and kill the whole session family.
    await prisma.refreshToken.updateMany({ where: { family: stored.family, revokedAt: null }, data: { revokedAt: new Date() } });
    logger.logAuditEvent('RefreshTokenReuse', 'Refresh token reuse detected, session revoked', { userId: stored.userId });
    void notify(stored.userId, 'security', 'Session ended', 'We signed you out because an old session token was reused.');
    throw unauthorized('Session revoked');
  }
  if (stored.expiresAt < new Date()) throw unauthorized('Refresh token expired');
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  authEvents.inc({ event: 'refresh' });
  res.json(await issueTokens(stored.user, stored.device, stored.family));
});

authRouter.post('/logout', async (req, res) => {
  const token = String(req.body?.refreshToken ?? '');
  if (token) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  res.status(204).end();
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  const result = await prisma.refreshToken.updateMany({ where: { userId: userId(req), revokedAt: null }, data: { revokedAt: new Date() } });
  logger.logAuditEvent('SessionsRevoked', 'All sessions signed out', { userId: userId(req), count: result.count });
  res.json({ revoked: result.count });
});

authRouter.post('/password', requireAuth, rateLimit('auth', authBucket), async (req, res) => {
  const input = body(req, z.object({ currentPassword: z.string(), newPassword: password }));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) throw unauthorized('Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.newPassword, 12) } });
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  logger.logAuditEvent('PasswordChanged', 'Password changed', { userId: user.id });
  void notify(user.id, 'security', 'Password changed', 'Your password was changed and other sessions were signed out.');
  res.json(await issueTokens(user, device(req)));
});

// ---- Two-factor authentication (TOTP) ----

authRouter.post('/2fa/setup', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
  if (user.twoFactorEnabled) throw conflict('Two-factor authentication is already enabled');
  const secret = newTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: encrypt(secret) } });
  const label = encodeURIComponent(`PocketBank:${user.email}`);
  res.json({ secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=PocketBank&algorithm=SHA1&digits=6&period=30` });
});

authRouter.post('/2fa/enable', requireAuth, async (req, res) => {
  const { code } = body(req, z.object({ code: z.string().trim() }));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
  if (!user.twoFactorSecret) throw badRequest('Run 2FA setup first');
  if (!verifyTotp(decrypt(user.twoFactorSecret), code)) throw unauthorized('Invalid verification code');
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  logger.logAuditEvent('TwoFactorEnabled', 'Two-factor authentication enabled', { userId: user.id });
  void notify(user.id, 'security', 'Two-factor authentication on', 'Sign-ins now need a code from your authenticator app.');
  res.json({ twoFactorEnabled: true });
});

authRouter.post('/2fa/disable', requireAuth, async (req, res) => {
  const input = body(req, z.object({ code: z.string().trim(), password: z.string() }));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
  if (!user.twoFactorEnabled || !user.twoFactorSecret) throw badRequest('Two-factor authentication is not enabled');
  if (!(await bcrypt.compare(input.password, user.passwordHash))) throw unauthorized('Password is incorrect');
  if (!verifyTotp(decrypt(user.twoFactorSecret), input.code)) throw unauthorized('Invalid verification code');
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  logger.logAuditEvent('TwoFactorDisabled', 'Two-factor authentication disabled', { userId: user.id });
  void notify(user.id, 'security', 'Two-factor authentication off', 'Two-factor authentication was turned off for your account.');
  res.json({ twoFactorEnabled: false });
});
