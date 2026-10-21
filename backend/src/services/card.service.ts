import type { CardKind, CardNetwork, CardType } from '../generated/prisma/enums.js';
import { prisma } from '../lib/infra.js';
import { encrypt, lookupHash, luhnComplete, randomDigits } from '../lib/security.js';

const BIN: Record<CardNetwork, string> = { VISA: '453201', MASTERCARD: '535522' };

export async function issueCard(input: {
  userId: string;
  accountId: string;
  kind: CardKind;
  network: CardNetwork;
  type?: CardType;
  cardholder: string;
  label?: string | null;
  dailyLimit?: number;
  monthlyLimit?: number;
}) {
  // Physical cards ship inactive and must be activated; virtual cards are usable immediately.
  for (let attempt = 0; attempt < 5; attempt++) {
    const pan = luhnComplete(BIN[input.network] + randomDigits(9));
    const now = new Date();
    try {
      return await prisma.card.create({
        data: {
          userId: input.userId,
          accountId: input.accountId,
          kind: input.kind,
          network: input.network,
          type: input.type ?? 'DEBIT',
          panEncrypted: encrypt(pan),
          panHash: lookupHash(pan),
          last4: pan.slice(-4),
          expiryMonth: now.getMonth() + 1,
          expiryYear: now.getFullYear() + (input.kind === 'VIRTUAL' ? 3 : 4),
          cvvEncrypted: encrypt(randomDigits(3)),
          cardholder: input.cardholder.toUpperCase(),
          label: input.label ?? null,
          status: input.kind === 'VIRTUAL' ? 'ACTIVE' : 'INACTIVE',
          dailyLimit: input.dailyLimit ?? (input.kind === 'VIRTUAL' ? 500 : 1000),
          monthlyLimit: input.monthlyLimit ?? (input.kind === 'VIRTUAL' ? 2000 : 5000),
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  }
  throw new Error('Could not generate a unique card number');
}

/** Card spend in the current day and month, used to enforce limits. */
export async function cardSpend(cardId: string) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [day, month] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { cardId, direction: 'DEBIT', createdAt: { gte: dayStart } } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { cardId, direction: 'DEBIT', createdAt: { gte: monthStart } } }),
  ]);
  return { today: Number(day._sum.amount ?? 0), thisMonth: Number(month._sum.amount ?? 0) };
}
