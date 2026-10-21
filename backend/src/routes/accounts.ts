import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { conflict, forbidden, unprocessable } from '../lib/errors.js';
import { cache, logger, prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { userId } from '../middleware/auth.js';
import { idempotent } from '../middleware/idempotency.js';
import { body, money } from '../middleware/validate.js';
import { SUPPORTED_CURRENCIES } from '../services/fx.service.js';
import { external } from '../services/ledger.service.js';
import { transactionsPdf } from '../services/report.service.js';
import { newAccountNumber, ownedAccount, param } from './helpers.js';
import { listTransactions, txFilters } from './transactions.js';

export const accountsRouter = Router();

accountsRouter.get('/accounts', async (req, res) => {
  const uid = userId(req);
  const accounts = await cache.getOrSetJson(
    `u:${uid}:accounts`,
    async () => (await prisma.account.findMany({ where: { userId: uid, status: { not: 'CLOSED' } }, orderBy: { createdAt: 'asc' } })).map(serialize.account),
    300,
  );
  res.json(accounts);
});

accountsRouter.post('/accounts', async (req, res) => {
  const input = body(
    req,
    z.object({
      accountType: z.enum(['SAVINGS', 'CHECKING', 'BUSINESS']),
      currency: z.string().toUpperCase().refine((c) => SUPPORTED_CURRENCIES.includes(c), 'Unsupported currency').default('USD'),
      nickname: z.string().trim().max(40).optional(),
    }),
  );
  const uid = userId(req);
  if ((await prisma.account.count({ where: { userId: uid, status: { not: 'CLOSED' } } })) >= 10) throw conflict('Account limit reached (10)');
  const account = await prisma.account.create({
    data: {
      userId: uid,
      type: input.accountType,
      currency: input.currency,
      nickname: input.nickname ?? null,
      accountNumber: await newAccountNumber(),
      interestRate: input.accountType === 'SAVINGS' ? config.savingsApy : 0,
    },
  });
  await cache.invalidatePattern(`u:${uid}:*`);
  logger.logAuditEvent('AccountOpened', `Opened ${account.type} account`, { userId: uid, accountId: account.id });
  res.status(201).json(serialize.account(account));
});

accountsRouter.get('/accounts/:id', async (req, res) => {
  const account = await ownedAccount(userId(req), param(req.params.id));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [incoming, outgoing, cards] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { accountId: account.id, direction: 'CREDIT', createdAt: { gte: monthStart } } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { accountId: account.id, direction: 'DEBIT', createdAt: { gte: monthStart } } }),
    prisma.card.count({ where: { accountId: account.id, status: { not: 'CANCELLED' } } }),
  ]);
  res.json({
    ...serialize.account(account),
    thisMonth: { incoming: Number(incoming._sum.amount ?? 0), outgoing: Number(outgoing._sum.amount ?? 0) },
    cardCount: cards,
  });
});

accountsRouter.patch('/accounts/:id', async (req, res) => {
  const input = body(req, z.object({ nickname: z.string().trim().max(40).nullable().optional(), status: z.enum(['ACTIVE', 'FROZEN']).optional() }));
  const uid = userId(req);
  const account = await ownedAccount(uid, param(req.params.id));
  if (account.status === 'CLOSED') throw unprocessable('ACCOUNT_CLOSED', 'Account is closed');
  const updated = await prisma.account.update({ where: { id: account.id }, data: { nickname: input.nickname, status: input.status } });
  if (input.status && input.status !== account.status) {
    logger.logAuditEvent(input.status === 'FROZEN' ? 'AccountFrozen' : 'AccountUnfrozen', `Account ${input.status.toLowerCase()}`, { userId: uid, accountId: account.id });
  }
  await cache.invalidatePattern(`u:${uid}:*`);
  res.json(serialize.account(updated));
});

accountsRouter.post('/accounts/:id/close', async (req, res) => {
  const uid = userId(req);
  const account = await ownedAccount(uid, param(req.params.id));
  if (!account.balance.isZero()) throw unprocessable('BALANCE_NOT_ZERO', 'Move the remaining balance out before closing the account');
  const updated = await prisma.account.update({ where: { id: account.id }, data: { status: 'CLOSED' } });
  await prisma.card.updateMany({ where: { accountId: account.id }, data: { status: 'CANCELLED' } });
  await cache.invalidatePattern(`u:${uid}:*`);
  logger.logAuditEvent('AccountClosed', 'Account closed', { userId: uid, accountId: account.id });
  res.json(serialize.account(updated));
});

/** Sandbox funding so a fresh account can be tried out without a card. Disabled when SANDBOX_DEPOSITS=false. */
accountsRouter.post('/accounts/:id/deposit', idempotent, async (req, res) => {
  if (process.env.SANDBOX_DEPOSITS === 'false' || (config.nodeEnv === 'production' && process.env.SANDBOX_DEPOSITS !== 'true')) {
    throw forbidden('Sandbox deposits are disabled');
  }
  const input = body(req, z.object({ amount: money.refine((v) => v <= 10_000, 'Sandbox deposits are capped at 10,000'), description: z.string().max(80).optional() }));
  const account = await ownedAccount(userId(req), param(req.params.id));
  const leg = await external(account, 'CREDIT', input.amount, { kind: 'DEPOSIT', description: input.description ?? 'Sandbox deposit', category: 'Income' });
  res.status(201).json(serialize.transaction(leg));
});

accountsRouter.get('/accounts/:id/transactions', async (req, res) => {
  const account = await ownedAccount(userId(req), param(req.params.id));
  res.json(await listTransactions(userId(req), { ...txFilters(req), accountId: account.id }));
});

accountsRouter.get('/accounts/:id/statement.pdf', async (req, res) => {
  const account = await ownedAccount(userId(req), param(req.params.id));
  const { month, year } = z
    .object({ month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1), year: z.coerce.number().int().min(2000).default(new Date().getFullYear()) })
    .parse(req.query);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const txs = await prisma.transaction.findMany({ where: { accountId: account.id, createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'asc' } });
  const pdf = await transactionsPdf(`Statement ${account.accountNumber} · ${year}-${String(month).padStart(2, '0')}`, txs);
  res.setHeader('content-type', 'application/pdf');
  res.setHeader('content-disposition', `attachment; filename="statement-${account.accountNumber}-${year}-${month}.pdf"`);
  res.send(pdf);
});
