import { mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import type { Prisma } from '../generated/prisma/client.js';
import { badRequest, notFound } from '../lib/errors.js';
import { cache, prisma } from '../lib/infra.js';
import { num } from '../lib/money.js';
import * as serialize from '../lib/serialize.js';
import { userId } from '../middleware/auth.js';
import { body, query } from '../middleware/validate.js';
import { transactionsCsv, transactionsPdf } from '../services/report.service.js';
import { param } from './helpers.js';

export const transactionsRouter = Router();

export const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills',
  'Utilities',
  'Housing',
  'Entertainment',
  'Health',
  'Education',
  'Travel',
  'Subscriptions',
  'Charity',
  'Transfers',
  'Income',
  'Investments',
  'Other',
];

const filterSchema = z.object({
  accountId: z.string().uuid().optional(),
  type: z.string().optional(),
  direction: z.enum(['CREDIT', 'DEBIT']).optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  cursor: z.string().uuid().optional(),
});

export type TxFilters = z.infer<typeof filterSchema>;

export const txFilters = (req: Request) => query(req, filterSchema);

function where(uid: string, f: TxFilters): Prisma.TransactionWhereInput {
  return {
    account: { userId: uid },
    ...(f.accountId ? { accountId: f.accountId } : {}),
    ...(f.type ? { kind: { in: f.type.split(',') as Prisma.EnumTxKindFilter['in'] } } : {}),
    ...(f.direction ? { direction: f.direction } : {}),
    ...(f.category ? { category: { equals: f.category, mode: 'insensitive' } } : {}),
    ...(f.tag ? { tags: { has: f.tag.toLowerCase() } } : {}),
    ...(f.q
      ? {
          OR: [
            { description: { contains: f.q, mode: 'insensitive' } },
            { merchant: { contains: f.q, mode: 'insensitive' } },
            { notes: { contains: f.q, mode: 'insensitive' } },
            { counterparty: { contains: f.q } },
          ],
        }
      : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    ...(f.minAmount !== undefined || f.maxAmount !== undefined
      ? { amount: { ...(f.minAmount !== undefined ? { gte: f.minAmount } : {}), ...(f.maxAmount !== undefined ? { lte: f.maxAmount } : {}) } }
      : {}),
  };
}

export async function listTransactions(uid: string, f: TxFilters) {
  const rows = await prisma.transaction.findMany({
    where: where(uid, f),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: f.limit + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > f.limit;
  const items = rows.slice(0, f.limit);
  return { items: items.map(serialize.transaction), nextCursor: hasMore ? items[items.length - 1].id : null };
}

async function ownedTx(uid: string, id: string) {
  const tx = await prisma.transaction.findFirst({ where: { id, account: { userId: uid } } });
  if (!tx) throw notFound('Transaction');
  return tx;
}

transactionsRouter.get('/transactions', async (req, res) => {
  res.json(await listTransactions(userId(req), txFilters(req)));
});

transactionsRouter.get('/transactions/categories', (_req, res) => {
  res.json(CATEGORIES);
});

transactionsRouter.get('/transactions/export/:format', async (req, res) => {
  const format = param(req.params.format);
  if (format !== 'csv' && format !== 'pdf') throw badRequest('Format must be csv or pdf');
  const uid = userId(req);
  const f = { ...txFilters(req), limit: 500 };
  const txs = await prisma.transaction.findMany({ where: where(uid, f), orderBy: { createdAt: 'asc' }, take: 5000 });
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="transactions-${stamp}.csv"`);
    return res.send(transactionsCsv(txs));
  }
  res.setHeader('content-type', 'application/pdf');
  res.setHeader('content-disposition', `attachment; filename="transactions-${stamp}.pdf"`);
  res.send(await transactionsPdf(`Transactions export ${stamp}`, txs));
});

/** Merchants charged at least 3 times at a regular interval are reported as recurring payments. */
transactionsRouter.get('/transactions/recurring', async (req, res) => {
  const uid = userId(req);
  const since = new Date(Date.now() - 180 * 86_400_000);
  const txs = await prisma.transaction.findMany({
    where: { account: { userId: uid }, direction: 'DEBIT', createdAt: { gte: since }, kind: { in: ['CARD_PURCHASE', 'BILL_PAYMENT', 'QR_PAYMENT', 'P2P_OUT'] } },
    orderBy: { createdAt: 'asc' },
  });
  const groups = new Map<string, typeof txs>();
  for (const t of txs) {
    const key = (t.merchant ?? t.counterparty ?? t.description).toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const recurring = [...groups.values()]
    .filter((g) => g.length >= 3)
    .map((g) => {
      const gaps = g.slice(1).map((t, i) => (t.createdAt.getTime() - g[i].createdAt.getTime()) / 86_400_000);
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const frequency = avgGap <= 9 ? 'WEEKLY' : avgGap <= 40 ? 'MONTHLY' : avgGap <= 100 ? 'QUARTERLY' : 'IRREGULAR';
      const last = g[g.length - 1];
      return {
        merchant: last.merchant ?? last.counterparty ?? last.description,
        category: last.category,
        averageAmount: Number((g.reduce((s, t) => s + num(t.amount), 0) / g.length).toFixed(2)),
        occurrences: g.length,
        frequency,
        lastDate: last.createdAt,
        nextDueDate: new Date(last.createdAt.getTime() + Math.round(avgGap) * 86_400_000),
      };
    })
    .filter((r) => r.frequency !== 'IRREGULAR');
  res.json(recurring);
});

transactionsRouter.post('/transactions/bulk-categorize', async (req, res) => {
  const input = body(req, z.object({ ids: z.array(z.string().uuid()).min(1).max(200), category: z.string().trim().min(1).max(40) }));
  const uid = userId(req);
  const result = await prisma.transaction.updateMany({ where: { id: { in: input.ids }, account: { userId: uid } }, data: { category: input.category } });
  await cache.invalidatePattern(`u:${uid}:*`);
  res.json({ updated: result.count });
});

transactionsRouter.get('/transactions/:id', async (req, res) => {
  const tx = await ownedTx(userId(req), param(req.params.id));
  const legs = await prisma.transaction.findMany({ where: { reference: tx.reference, id: { not: tx.id }, account: { userId: userId(req) } } });
  res.json({ ...serialize.transaction(tx), related: legs.map(serialize.transaction) });
});

transactionsRouter.patch('/transactions/:id', async (req, res) => {
  const input = body(
    req,
    z.object({
      category: z.string().trim().min(1).max(40).optional(),
      notes: z.string().trim().max(500).nullable().optional(),
      tags: z.array(z.string().trim().toLowerCase().min(1).max(24)).max(10).optional(),
    }),
  );
  const uid = userId(req);
  const tx = await ownedTx(uid, param(req.params.id));
  const updated = await prisma.transaction.update({
    where: { id: tx.id },
    data: { category: input.category, notes: input.notes, tags: input.tags ? [...new Set(input.tags)] : undefined },
  });
  await cache.invalidatePattern(`u:${uid}:*`);
  res.json(serialize.transaction(updated));
});

// ---- receipts ----

const uploadDir = resolve(config.uploadDir, 'receipts');
mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(file.mimetype)),
});

transactionsRouter.post('/transactions/:id/receipt', upload.single('file'), async (req, res) => {
  const tx = await ownedTx(userId(req), param(req.params.id));
  if (!req.file) throw badRequest('Attach an image or PDF as "file"');
  const updated = await prisma.transaction.update({ where: { id: tx.id }, data: { receiptPath: req.file.filename } });
  res.status(201).json(serialize.transaction(updated));
});

transactionsRouter.get('/transactions/:id/receipt', async (req, res) => {
  const tx = await ownedTx(userId(req), param(req.params.id));
  if (!tx.receiptPath) throw notFound('Receipt');
  res.sendFile(join(uploadDir, tx.receiptPath));
});

transactionsRouter.delete('/transactions/:id/receipt', async (req, res) => {
  const tx = await ownedTx(userId(req), param(req.params.id));
  await prisma.transaction.update({ where: { id: tx.id }, data: { receiptPath: null } });
  res.status(204).end();
});
