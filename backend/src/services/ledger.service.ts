/**
 * Ledger: the only code path that changes account balances. Every movement is a pair of
 * Transaction rows (or a single row for external flows) written in one database transaction,
 * with the balance updated by a conditional UPDATE so an account can never go negative.
 */
import { randomUUID } from 'node:crypto';
import { Prisma, type Account, type Transaction } from '../generated/prisma/client.js';
import type { TxKind } from '../generated/prisma/enums.js';
import { notFound, unprocessable } from '../lib/errors.js';
import { cache, logger, prisma } from '../lib/infra.js';
import { dec, num, toMoney, type Dec } from '../lib/money.js';
import { moneyMoved } from '../metrics.js';
import { checkBudgetAlerts } from './budget.service.js';
import { rate } from './fx.service.js';
import { notify } from './notification.service.js';

export type TxClient = Prisma.TransactionClient;

export interface LegMeta {
  kind: TxKind;
  description: string;
  category?: string;
  merchant?: string | null;
  counterparty?: string | null;
  cardId?: string | null;
  notes?: string | null;
  tags?: string[];
  reference?: string;
  fxRate?: number | null;
}

/** Lock rows in id order so two opposite transfers cannot deadlock. */
async function lockAccounts(tx: TxClient, ids: string[]): Promise<void> {
  const sorted = [...new Set(ids)].sort();
  await tx.$queryRaw`SELECT id FROM "Account" WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`;
}

export async function debit(tx: TxClient, accountId: string, amount: Dec, meta: LegMeta): Promise<Transaction> {
  const updated = await tx.account.updateMany({
    where: { id: accountId, status: 'ACTIVE', balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  const account = await tx.account.findUnique({ where: { id: accountId } });
  if (!account) throw notFound('Account');
  if (updated.count === 0) {
    if (account.status !== 'ACTIVE') throw unprocessable('ACCOUNT_NOT_ACTIVE', `Account is ${account.status.toLowerCase()}`);
    throw unprocessable('INSUFFICIENT_FUNDS', 'Insufficient funds');
  }
  return tx.transaction.create({
    data: {
      accountId,
      direction: 'DEBIT',
      kind: meta.kind,
      amount,
      balanceAfter: account.balance,
      currency: account.currency,
      description: meta.description,
      category: meta.category ?? 'Other',
      merchant: meta.merchant ?? null,
      counterparty: meta.counterparty ?? null,
      cardId: meta.cardId ?? null,
      notes: meta.notes ?? null,
      tags: meta.tags ?? [],
      reference: meta.reference ?? randomUUID(),
      fxRate: meta.fxRate ?? null,
    },
  });
}

export async function credit(tx: TxClient, accountId: string, amount: Dec, meta: LegMeta): Promise<Transaction> {
  const updated = await tx.account.updateMany({
    where: { id: accountId, status: { not: 'CLOSED' } },
    data: { balance: { increment: amount } },
  });
  if (updated.count === 0) throw unprocessable('ACCOUNT_CLOSED', 'Destination account is closed or missing');
  const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
  return tx.transaction.create({
    data: {
      accountId,
      direction: 'CREDIT',
      kind: meta.kind,
      amount,
      balanceAfter: account.balance,
      currency: account.currency,
      description: meta.description,
      category: meta.category ?? 'Income',
      merchant: meta.merchant ?? null,
      counterparty: meta.counterparty ?? null,
      notes: meta.notes ?? null,
      tags: meta.tags ?? [],
      reference: meta.reference ?? randomUUID(),
      fxRate: meta.fxRate ?? null,
    },
  });
}

export interface TransferInput {
  from: Account;
  to: Account;
  amount: number;
  outKind: TxKind;
  inKind: TxKind;
  description: string;
  category?: string;
  notes?: string | null;
  counterpartyOut?: string;
  counterpartyIn?: string;
}

/** Move money between two accounts (own or another customer's), converting currency if needed. */
export async function transfer(input: TransferInput) {
  const { from, to } = input;
  if (from.id === to.id) throw unprocessable('SAME_ACCOUNT', 'Cannot transfer to the same account');
  const amount = toMoney(input.amount);
  const fx = from.currency === to.currency ? 1 : await rate(from.currency, to.currency);
  const credited = toMoney(amount.mul(fx));
  const reference = randomUUID();

  const [out, inbound] = await prisma.$transaction(async (tx) => {
    await lockAccounts(tx, [from.id, to.id]);
    const outLeg = await debit(tx, from.id, amount, {
      kind: input.outKind,
      description: input.description,
      category: input.category ?? 'Transfers',
      counterparty: input.counterpartyOut ?? to.accountNumber,
      notes: input.notes,
      reference,
      fxRate: fx === 1 ? null : fx,
    });
    const inLeg = await credit(tx, to.id, credited, {
      kind: input.inKind,
      description: input.description,
      category: 'Transfers',
      counterparty: input.counterpartyIn ?? from.accountNumber,
      notes: input.notes,
      reference,
      fxRate: fx === 1 ? null : fx,
    });
    return [outLeg, inLeg] as const;
  });

  await afterPosting([
    { userId: from.userId, leg: out },
    { userId: to.userId, leg: inbound },
  ]);
  return { reference, debit: out, credit: inbound, fxRate: fx, creditedAmount: num(credited) };
}

/** Single-legged movement against the outside world (bill payee, merchant, card network, Stripe). */
export async function external(
  account: Account,
  direction: 'DEBIT' | 'CREDIT',
  amount: number | Dec,
  meta: LegMeta,
  extra?: (tx: TxClient, leg: Transaction) => Promise<void>,
): Promise<Transaction> {
  const value = toMoney(amount);
  const leg = await prisma.$transaction(async (tx) => {
    await lockAccounts(tx, [account.id]);
    const created = direction === 'DEBIT' ? await debit(tx, account.id, value, meta) : await credit(tx, account.id, value, meta);
    if (extra) await extra(tx, created);
    return created;
  });
  await afterPosting([{ userId: account.userId, leg }]);
  return leg;
}

/** Side effects after commit: metrics, cache invalidation, transaction alerts and budget alerts. */
export async function afterPosting(entries: { userId: string; leg: Transaction }[]): Promise<void> {
  for (const { userId, leg } of entries) {
    moneyMoved.inc({ kind: leg.kind, currency: leg.currency }, num(leg.amount));
    logger.logAuditEvent('LedgerPosted', `${leg.direction} ${leg.kind} ${leg.amount.toFixed(2)} ${leg.currency}`, {
      userId,
      accountId: leg.accountId,
      transactionId: leg.id,
      reference: leg.reference,
    });
    await cache.invalidatePattern(`u:${userId}:*`);
    const sign = leg.direction === 'DEBIT' ? '-' : '+';
    void notify(userId, 'transaction', leg.direction === 'DEBIT' ? 'Money sent' : 'Money received', `${sign}${leg.currency} ${leg.amount.toFixed(2)} · ${leg.description}`, {
      transactionId: leg.id,
      accountId: leg.accountId,
    });
    if (leg.direction === 'DEBIT') void checkBudgetAlerts(userId, leg.category);
  }
}

export const zero = () => dec(0);
