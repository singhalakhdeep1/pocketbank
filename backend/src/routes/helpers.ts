import type { Recurrence } from '../generated/prisma/enums.js';
import { notFound } from '../lib/errors.js';
import { prisma } from '../lib/infra.js';
import { randomDigits } from '../lib/security.js';

export async function ownedAccount(userId: string, accountId: string) {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw notFound('Account');
  return account;
}

/** The user's first active account in `currency` (CHECKING preferred) when the client did not pick one. */
export async function defaultAccount(userId: string, accountId?: string | null) {
  if (accountId) return ownedAccount(userId, accountId);
  const accounts = await prisma.account.findMany({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
  const pick = accounts.find((a) => a.type === 'CHECKING') ?? accounts[0];
  if (!pick) throw notFound('Active account');
  return pick;
}

export async function newAccountNumber(): Promise<string> {
  for (;;) {
    const candidate = `40${randomDigits(8)}`;
    if (!(await prisma.account.findUnique({ where: { accountNumber: candidate } }))) return candidate;
  }
}

export function nextOccurrence(from: Date, recurrence: Recurrence): Date | null {
  const next = new Date(from);
  switch (recurrence) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      return next;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      return next;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      return next;
    default:
      return null;
  }
}

export const maskName = (first: string, last: string) => `${first} ${last.charAt(0)}.`;

export const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : (value ?? ''));
