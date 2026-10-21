import { Router } from 'express';
import { z } from 'zod';
import { logger, prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { userId } from '../middleware/auth.js';
import { body, query } from '../middleware/validate.js';
import { param } from './helpers.js';

export const profileRouter = Router();

profileRouter.get('/profile', async (req, res) => {
  res.json(serialize.user(await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } })));
});

profileRouter.patch('/profile', async (req, res) => {
  const input = body(
    req,
    z.object({
      firstName: z.string().trim().min(1).max(60).optional(),
      lastName: z.string().trim().min(1).max(60).optional(),
      phone: z.string().trim().max(30).nullable().optional(),
      language: z.enum(['en', 'es', 'fr', 'de', 'hi']).optional(),
      notifications: z
        .object({ transactions: z.boolean().optional(), security: z.boolean().optional(), budget: z.boolean().optional() })
        .optional(),
    }),
  );
  const user = await prisma.user.update({
    where: { id: userId(req) },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      language: input.language,
      notifyTransactions: input.notifications?.transactions,
      notifySecurity: input.notifications?.security,
      notifyBudget: input.notifications?.budget,
    },
  });
  logger.logAuditEvent('ProfileUpdated', 'Profile updated', { userId: user.id, fields: Object.keys(input) });
  res.json(serialize.user(user));
});

profileRouter.post('/profile/push-token', async (req, res) => {
  const { token } = body(req, z.object({ token: z.string().regex(/^(Expo|Exponent)PushToken\[.+\]$/, 'Expected an Expo push token') }));
  await prisma.user.update({ where: { id: userId(req) }, data: { pushToken: token } });
  res.json({ registered: true });
});

profileRouter.delete('/profile/push-token', async (req, res) => {
  await prisma.user.update({ where: { id: userId(req) }, data: { pushToken: null } });
  res.json({ registered: false });
});

profileRouter.get('/profile/security-log', async (req, res) => {
  const events = await prisma.auditLog.findMany({
    where: { userId: userId(req), eventType: { not: 'LedgerPosted' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(events.map((e) => ({ id: e.id, eventType: e.eventType, description: e.description, createdAt: e.createdAt })));
});

// ---- notifications ----

profileRouter.get('/notifications', async (req, res) => {
  const { unread, limit } = query(req, z.object({ unread: z.enum(['true', 'false']).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }));
  const where = { userId: userId(req), ...(unread === 'true' ? { read: false } : {}) };
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.notification.count({ where: { userId: userId(req), read: false } }),
  ]);
  res.json({ items: items.map(serialize.notification), unreadCount });
});

profileRouter.post('/notifications/read-all', async (req, res) => {
  const result = await prisma.notification.updateMany({ where: { userId: userId(req), read: false }, data: { read: true } });
  res.json({ updated: result.count });
});

profileRouter.post('/notifications/:id/read', async (req, res) => {
  await prisma.notification.updateMany({ where: { id: param(req.params.id), userId: userId(req) }, data: { read: true } });
  res.json({ read: true });
});
