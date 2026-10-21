import { Router } from 'express';
import { z } from 'zod';
import type { Account, User } from '../generated/prisma/client.js';
import { badRequest, notFound, unprocessable } from '../lib/errors.js';
import { prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { userId } from '../middleware/auth.js';
import { idempotent } from '../middleware/idempotency.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { body, money } from '../middleware/validate.js';
import { transfer } from '../services/ledger.service.js';
import { maskName, ownedAccount, param } from './helpers.js';

export const transfersRouter = Router();

const transferBucket = { capacity: 20, refillPerSecond: 0.2 };

async function recipientAccount(input: { toAccount?: string; toEmail?: string }, currency: string) {
  if (input.toAccount) {
    const account = await prisma.account.findUnique({ where: { accountNumber: input.toAccount.replace(/\s/g, '') }, include: { user: true } });
    if (!account || account.status === 'CLOSED') throw notFound('Recipient account');
    return account;
  }
  if (input.toEmail) {
    const user = await prisma.user.findUnique({ where: { email: input.toEmail.toLowerCase() }, include: { accounts: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } } });
    // Prefer an account in the sender's currency, then the recipient's checking account.
    const account =
      user?.accounts.find((a) => a.currency === currency && a.type === 'CHECKING') ??
      user?.accounts.find((a) => a.currency === currency) ??
      user?.accounts[0];
    if (!user || !account) throw notFound('Recipient');
    return { ...account, user };
  }
  throw badRequest('Provide toAccount or toEmail');
}

/** Same-owner transfers are TRANSFER_*; transfers to anyone else are P2P_*. */
export async function sendMoney(
  uid: string,
  from: Account,
  to: Account & { user: User },
  amount: number,
  note: string | null | undefined,
  description?: string,
) {
  const sender = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  const own = to.userId === uid;
  const result = await transfer({
    from,
    to,
    amount,
    outKind: own ? 'TRANSFER_OUT' : 'P2P_OUT',
    inKind: own ? 'TRANSFER_IN' : 'P2P_IN',
    description: description ?? (own ? 'Transfer between accounts' : `Transfer ${amount.toFixed(2)}`),
    category: own ? 'Transfers' : 'Transfers',
    notes: note,
    counterpartyOut: own ? to.accountNumber : `${maskName(to.user.firstName, to.user.lastName)} · ${to.accountNumber}`,
    counterpartyIn: own ? from.accountNumber : `${maskName(sender.firstName, sender.lastName)} · ${from.accountNumber}`,
  });
  return { own, result };
}

transfersRouter.get('/transfers/lookup', async (req, res) => {
  const { accountNumber, email } = z.object({ accountNumber: z.string().optional(), email: z.string().optional() }).parse(req.query);
  const account = await recipientAccount({ toAccount: accountNumber, toEmail: email }, 'USD');
  res.json({
    accountNumber: account.accountNumber,
    name: maskName(account.user.firstName, account.user.lastName),
    currency: account.currency,
    isOwnAccount: account.userId === userId(req),
  });
});

transfersRouter.post('/transfers/internal', rateLimit('transfer', transferBucket), idempotent, async (req, res) => {
  const input = body(req, z.object({ fromAccountId: z.string().uuid(), toAccountId: z.string().uuid(), amount: money, note: z.string().max(140).optional() }));
  const uid = userId(req);
  const from = await ownedAccount(uid, input.fromAccountId);
  const to = await ownedAccount(uid, input.toAccountId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  const { result } = await sendMoney(uid, from, { ...to, user }, input.amount, input.note);
  res.status(201).json({ reference: result.reference, fxRate: result.fxRate, creditedAmount: result.creditedAmount, debit: serialize.transaction(result.debit) });
});

transfersRouter.post('/transfers/p2p', rateLimit('transfer', transferBucket), idempotent, async (req, res) => {
  const input = body(
    req,
    z
      .object({
        fromAccountId: z.string().uuid().optional(),
        toAccount: z.string().trim().optional(),
        toEmail: z.string().trim().optional(),
        amount: money,
        note: z.string().max(140).optional(),
        savePayee: z.boolean().default(true),
      })
      .refine((v) => v.toAccount || v.toEmail, 'toAccount or toEmail is required'),
  );
  const uid = userId(req);
  const from = input.fromAccountId
    ? await ownedAccount(uid, input.fromAccountId)
    : await prisma.account.findFirst({ where: { userId: uid, status: 'ACTIVE', type: 'CHECKING' }, orderBy: { createdAt: 'asc' } });
  if (!from) throw notFound('Source account');
  const to = await recipientAccount(input, from.currency);
  const { own, result } = await sendMoney(uid, from, to, input.amount, input.note, input.note ? input.note : undefined);
  if (!own && input.savePayee) {
    const name = `${to.user.firstName} ${to.user.lastName}`;
    await prisma.payee.upsert({
      where: { userId_accountNumber: { userId: uid, accountNumber: to.accountNumber } },
      update: { lastUsedAt: new Date(), name },
      create: { userId: uid, accountNumber: to.accountNumber, name },
    });
  }
  res.status(201).json({
    reference: result.reference,
    fxRate: result.fxRate,
    creditedAmount: result.creditedAmount,
    recipient: { name: maskName(to.user.firstName, to.user.lastName), accountNumber: to.accountNumber },
    debit: serialize.transaction(result.debit),
  });
});

// ---- saved payees (recent contacts / payment templates) ----

transfersRouter.get('/payees', async (req, res) => {
  const payees = await prisma.payee.findMany({ where: { userId: userId(req) }, orderBy: { lastUsedAt: 'desc' }, take: 20 });
  res.json(payees.map(serialize.payee));
});

transfersRouter.post('/payees', async (req, res) => {
  const input = body(req, z.object({ accountNumber: z.string().trim(), name: z.string().trim().max(60).optional() }));
  const uid = userId(req);
  const account = await prisma.account.findUnique({ where: { accountNumber: input.accountNumber }, include: { user: true } });
  if (!account) throw notFound('Account');
  if (account.userId === uid) throw unprocessable('OWN_ACCOUNT', 'That is one of your own accounts');
  const payee = await prisma.payee.upsert({
    where: { userId_accountNumber: { userId: uid, accountNumber: account.accountNumber } },
    update: { name: input.name ?? `${account.user.firstName} ${account.user.lastName}` },
    create: { userId: uid, accountNumber: account.accountNumber, name: input.name ?? `${account.user.firstName} ${account.user.lastName}` },
  });
  res.status(201).json(serialize.payee(payee));
});

transfersRouter.delete('/payees/:id', async (req, res) => {
  await prisma.payee.deleteMany({ where: { id: param(req.params.id), userId: userId(req) } });
  res.status(204).end();
});

// ---- scheduled and recurring payments ----

const scheduleSchema = z
  .object({
    kind: z.enum(['TRANSFER', 'P2P', 'BILL']),
    fromAccountId: z.string().uuid(),
    toAccountNumber: z.string().trim().optional(),
    billId: z.string().uuid().optional(),
    amount: money,
    description: z.string().trim().min(1).max(80),
    frequency: z.enum(['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('NONE'),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
  })
  .refine((v) => (v.kind === 'BILL' ? Boolean(v.billId) : Boolean(v.toAccountNumber)), 'Transfers need toAccountNumber, bill payments need billId');

transfersRouter.get('/payments/scheduled', async (req, res) => {
  const items = await prisma.scheduledPayment.findMany({ where: { userId: userId(req) }, orderBy: [{ active: 'desc' }, { nextRunAt: 'asc' }] });
  res.json(items.map(serialize.scheduled));
});

transfersRouter.post('/payments/scheduled', async (req, res) => {
  const input = body(req, scheduleSchema);
  const uid = userId(req);
  await ownedAccount(uid, input.fromAccountId);
  if (input.kind === 'BILL') {
    if (!(await prisma.bill.findFirst({ where: { id: input.billId, userId: uid } }))) throw notFound('Bill');
  } else if (!(await prisma.account.findUnique({ where: { accountNumber: input.toAccountNumber } }))) {
    throw notFound('Recipient account');
  }
  if (input.startDate.getTime() < Date.now() - 60_000) throw badRequest('Start date must be in the future');
  const item = await prisma.scheduledPayment.create({
    data: {
      userId: uid,
      kind: input.kind,
      fromAccountId: input.fromAccountId,
      toAccountNumber: input.toAccountNumber ?? null,
      billId: input.billId ?? null,
      amount: input.amount,
      description: input.description,
      frequency: input.frequency,
      nextRunAt: input.startDate,
      endDate: input.endDate ?? null,
    },
  });
  res.status(201).json(serialize.scheduled(item));
});

transfersRouter.patch('/payments/scheduled/:id', async (req, res) => {
  const input = body(req, z.object({ active: z.boolean().optional(), amount: money.optional(), nextRunAt: z.coerce.date().optional(), description: z.string().max(80).optional() }));
  const uid = userId(req);
  const existing = await prisma.scheduledPayment.findFirst({ where: { id: param(req.params.id), userId: uid } });
  if (!existing) throw notFound('Scheduled payment');
  const item = await prisma.scheduledPayment.update({ where: { id: existing.id }, data: input });
  res.json(serialize.scheduled(item));
});

transfersRouter.delete('/payments/scheduled/:id', async (req, res) => {
  await prisma.scheduledPayment.deleteMany({ where: { id: param(req.params.id), userId: userId(req) } });
  res.status(204).end();
});
