import { Router } from 'express';
import { z } from 'zod';
import type { Account, Bill } from '../generated/prisma/client.js';
import { conflict, notFound } from '../lib/errors.js';
import { prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { userId } from '../middleware/auth.js';
import { idempotent } from '../middleware/idempotency.js';
import { body, money } from '../middleware/validate.js';
import { external } from '../services/ledger.service.js';
import { defaultAccount, nextOccurrence, ownedAccount, param } from './helpers.js';

export const billsRouter = Router();

const BILL_CATEGORIES = ['utilities', 'rent', 'insurance', 'phone', 'internet', 'credit_card', 'subscription', 'other'] as const;
const LEDGER_CATEGORY: Record<string, string> = {
  utilities: 'Utilities',
  rent: 'Housing',
  insurance: 'Bills',
  phone: 'Bills',
  internet: 'Utilities',
  credit_card: 'Bills',
  subscription: 'Subscriptions',
  other: 'Bills',
};

/** Pays a bill from `account`; recurring bills roll their due date forward, one-off bills become PAID. */
export async function payBill(bill: Bill, account: Account) {
  if (bill.status === 'PAID') throw conflict('Bill is already paid');
  const next = nextOccurrence(bill.dueDate, bill.recurrence);
  const leg = await external(
    account,
    'DEBIT',
    bill.amount,
    { kind: 'BILL_PAYMENT', description: `${bill.name} · ${bill.payee}`, merchant: bill.payee, category: LEDGER_CATEGORY[bill.category] ?? 'Bills', counterparty: bill.payee },
    async (tx) => {
      await tx.bill.update({
        where: { id: bill.id },
        data: next ? { dueDate: next, status: 'PENDING', lastPaidAt: new Date(), reminderSentFor: null } : { status: 'PAID', lastPaidAt: new Date() },
      });
    },
  );
  return leg;
}

async function ownedBill(uid: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, userId: uid } });
  if (!bill) throw notFound('Bill');
  return bill;
}

billsRouter.get('/bills', async (req, res) => {
  const bills = await prisma.bill.findMany({ where: { userId: userId(req) }, orderBy: { dueDate: 'asc' } });
  const views = bills.map(serialize.bill);
  const due = views.filter((b) => b.status !== 'PAID');
  res.json({
    items: views,
    summary: {
      totalDue: Number(due.reduce((s, b) => s + b.amount, 0).toFixed(2)),
      pendingCount: due.length,
      overdueCount: views.filter((b) => b.status === 'OVERDUE').length,
      dueThisWeek: due.filter((b) => new Date(b.dueDate).getTime() < Date.now() + 7 * 86_400_000).length,
    },
  });
});

const billSchema = z.object({
  name: z.string().trim().min(1).max(60),
  payee: z.string().trim().min(1).max(60),
  category: z.enum(BILL_CATEGORIES).default('utilities'),
  amount: money,
  dueDate: z.coerce.date(),
  recurrence: z.enum(['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('MONTHLY'),
  autoPay: z.boolean().default(false),
  accountId: z.string().uuid().optional(),
});

billsRouter.post('/bills', async (req, res) => {
  const input = body(req, billSchema);
  const uid = userId(req);
  if (input.accountId) await ownedAccount(uid, input.accountId);
  const bill = await prisma.bill.create({ data: { ...input, accountId: input.accountId ?? null, userId: uid } });
  res.status(201).json(serialize.bill(bill));
});

billsRouter.patch('/bills/:id', async (req, res) => {
  const input = body(req, billSchema.partial());
  const uid = userId(req);
  const bill = await ownedBill(uid, param(req.params.id));
  if (input.accountId) await ownedAccount(uid, input.accountId);
  const updated = await prisma.bill.update({
    where: { id: bill.id },
    data: { ...input, ...(input.dueDate && bill.status === 'PAID' ? { status: 'PENDING' } : {}) },
  });
  res.json(serialize.bill(updated));
});

billsRouter.delete('/bills/:id', async (req, res) => {
  const bill = await ownedBill(userId(req), param(req.params.id));
  await prisma.bill.delete({ where: { id: bill.id } });
  await prisma.scheduledPayment.deleteMany({ where: { billId: bill.id } });
  res.status(204).end();
});

billsRouter.post('/bills/:id/pay', idempotent, async (req, res) => {
  const input = body(req, z.object({ accountId: z.string().uuid().optional() }));
  const uid = userId(req);
  const bill = await ownedBill(uid, param(req.params.id));
  const account = await defaultAccount(uid, input.accountId ?? bill.accountId);
  const leg = await payBill(bill, account);
  res.status(201).json({ bill: serialize.bill(await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } })), transaction: serialize.transaction(leg) });
});

billsRouter.patch('/bills/:id/autopay', async (req, res) => {
  const input = body(req, z.object({ enabled: z.boolean(), accountId: z.string().uuid().optional() }));
  const uid = userId(req);
  const bill = await ownedBill(uid, param(req.params.id));
  if (input.accountId) await ownedAccount(uid, input.accountId);
  const updated = await prisma.bill.update({
    where: { id: bill.id },
    data: { autoPay: input.enabled, ...(input.accountId ? { accountId: input.accountId } : {}) },
  });
  res.json(serialize.bill(updated));
});
