import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { conflict, notFound, unauthorized, unprocessable } from '../lib/errors.js';
import { logger, prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { decrypt } from '../lib/security.js';
import { userId } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { body, money } from '../middleware/validate.js';
import { cardSpend, issueCard } from '../services/card.service.js';
import { notify } from '../services/notification.service.js';
import { defaultAccount, param } from './helpers.js';

export const cardsRouter = Router();

async function ownedCard(uid: string, id: string) {
  const card = await prisma.card.findFirst({ where: { id, userId: uid } });
  if (!card) throw notFound('Card');
  return card;
}

async function withSpend(card: Awaited<ReturnType<typeof ownedCard>>) {
  const [spend, account] = await Promise.all([cardSpend(card.id), prisma.account.findUniqueOrThrow({ where: { id: card.accountId } })]);
  return {
    ...serialize.card(card),
    spentToday: spend.today,
    spentThisMonth: spend.thisMonth,
    availableBalance: Number(account.balance),
    currency: account.currency,
    accountNumber: account.accountNumber,
  };
}

cardsRouter.get('/cards', async (req, res) => {
  const { kind } = z.object({ kind: z.enum(['PHYSICAL', 'VIRTUAL']).optional() }).parse(req.query);
  const cards = await prisma.card.findMany({
    where: { userId: userId(req), status: { not: 'CANCELLED' }, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  res.json(await Promise.all(cards.map(withSpend)));
});

cardsRouter.post('/cards', async (req, res) => {
  const input = body(
    req,
    z.object({
      kind: z.enum(['PHYSICAL', 'VIRTUAL']).default('VIRTUAL'),
      network: z.enum(['VISA', 'MASTERCARD']).default('VISA'),
      type: z.enum(['DEBIT', 'CREDIT']).default('DEBIT'),
      accountId: z.string().uuid().optional(),
      label: z.string().trim().max(30).optional(),
      dailyLimit: money.optional(),
      monthlyLimit: money.optional(),
    }),
  );
  const uid = userId(req);
  const account = await defaultAccount(uid, input.accountId);
  const active = await prisma.card.count({ where: { userId: uid, kind: input.kind, status: { not: 'CANCELLED' } } });
  if (input.kind === 'VIRTUAL' && active >= 5) throw conflict('You can have up to 5 virtual cards');
  if (input.kind === 'PHYSICAL' && (await prisma.card.count({ where: { accountId: account.id, kind: 'PHYSICAL', status: { not: 'CANCELLED' } } })) > 0) {
    throw conflict('This account already has a physical card');
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  const card = await issueCard({
    userId: uid,
    accountId: account.id,
    kind: input.kind,
    network: input.network,
    type: input.type,
    cardholder: `${user.firstName} ${user.lastName}`,
    label: input.label,
    dailyLimit: input.dailyLimit,
    monthlyLimit: input.monthlyLimit,
  });
  logger.logAuditEvent('CardIssued', `${card.kind} ${card.network} card issued`, { userId: uid, cardId: card.id });
  res.status(201).json(await withSpend(card));
});

cardsRouter.get('/cards/:id', async (req, res) => {
  res.json(await withSpend(await ownedCard(userId(req), param(req.params.id))));
});

cardsRouter.patch('/cards/:id', async (req, res) => {
  const input = body(
    req,
    z
      .object({
        dailyLimit: money.optional(),
        monthlyLimit: money.optional(),
        onlineEnabled: z.boolean().optional(),
        contactlessEnabled: z.boolean().optional(),
        label: z.string().trim().max(30).nullable().optional(),
      })
      .refine((v) => !(v.dailyLimit && v.monthlyLimit && v.dailyLimit > v.monthlyLimit), 'Daily limit cannot exceed monthly limit'),
  );
  const uid = userId(req);
  const card = await ownedCard(uid, param(req.params.id));
  if (card.status === 'CANCELLED') throw unprocessable('CARD_CANCELLED', 'Card is cancelled');
  const daily = input.dailyLimit ?? Number(card.dailyLimit);
  const monthly = input.monthlyLimit ?? Number(card.monthlyLimit);
  if (daily > monthly) throw unprocessable('LIMITS_INVALID', 'Daily limit cannot exceed monthly limit');
  const updated = await prisma.card.update({ where: { id: card.id }, data: input });
  logger.logAuditEvent('CardSettingsChanged', 'Card settings changed', { userId: uid, cardId: card.id, changes: input });
  res.json(await withSpend(updated));
});

cardsRouter.post('/cards/:id/activate', async (req, res) => {
  const { last4 } = body(req, z.object({ last4: z.string().regex(/^\d{4}$/) }));
  const uid = userId(req);
  const card = await ownedCard(uid, param(req.params.id));
  if (card.status !== 'INACTIVE') throw conflict('Card is already activated');
  if (card.last4 !== last4) throw unprocessable('LAST4_MISMATCH', 'Those digits do not match the card');
  const updated = await prisma.card.update({ where: { id: card.id }, data: { status: 'ACTIVE' } });
  logger.logAuditEvent('CardActivated', 'Card activated', { userId: uid, cardId: card.id });
  res.json(await withSpend(updated));
});

async function setFrozen(uid: string, id: string, frozen: boolean) {
  const card = await ownedCard(uid, id);
  if (card.status === 'CANCELLED' || card.status === 'INACTIVE') throw unprocessable('CARD_NOT_ACTIVE', `Card is ${card.status.toLowerCase()}`);
  const updated = await prisma.card.update({ where: { id: card.id }, data: { status: frozen ? 'FROZEN' : 'ACTIVE' } });
  logger.logAuditEvent(frozen ? 'CardFrozen' : 'CardUnfrozen', `Card ${frozen ? 'frozen' : 'unfrozen'}`, { userId: uid, cardId: card.id });
  void notify(uid, 'security', frozen ? 'Card frozen' : 'Card unfrozen', `Card ending ${card.last4} is now ${frozen ? 'frozen' : 'active'}.`);
  return updated;
}

cardsRouter.post('/cards/:id/freeze', async (req, res) => {
  res.json(await withSpend(await setFrozen(userId(req), param(req.params.id), true)));
});

cardsRouter.post('/cards/:id/unfreeze', async (req, res) => {
  res.json(await withSpend(await setFrozen(userId(req), param(req.params.id), false)));
});

/** Full card number + CVV, only after re-entering the password; the app also gates it behind biometrics. */
cardsRouter.post('/cards/:id/reveal', rateLimit('reveal', { capacity: 5, refillPerSecond: 0.05 }), async (req, res) => {
  const { password } = body(req, z.object({ password: z.string().min(1) }));
  const uid = userId(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  if (!(await bcrypt.compare(password, user.passwordHash))) throw unauthorized('Password is incorrect');
  const card = await ownedCard(uid, param(req.params.id));
  logger.logAuditEvent('CardRevealed', 'Full card details viewed', { userId: uid, cardId: card.id });
  const pan = decrypt(card.panEncrypted);
  res.json({ cardNumber: pan.replace(/(\d{4})(?=\d)/g, '$1 '), cvv: decrypt(card.cvvEncrypted), expiry: serialize.card(card).expiry, cardholder: card.cardholder });
});

cardsRouter.delete('/cards/:id', async (req, res) => {
  const uid = userId(req);
  const card = await ownedCard(uid, param(req.params.id));
  await prisma.card.update({ where: { id: card.id }, data: { status: 'CANCELLED' } });
  logger.logAuditEvent('CardCancelled', 'Card cancelled', { userId: uid, cardId: card.id });
  res.status(204).end();
});
