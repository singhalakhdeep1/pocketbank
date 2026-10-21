import { Router } from 'express';
import { z } from 'zod';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import { prisma } from '../lib/infra.js';
import { dec, toMoney } from '../lib/money.js';
import * as serialize from '../lib/serialize.js';
import { userId } from '../middleware/auth.js';
import { idempotent } from '../middleware/idempotency.js';
import { body, money } from '../middleware/validate.js';
import { transfer } from '../services/ledger.service.js';
import { notify } from '../services/notification.service.js';
import { defaultAccount, maskName, param } from './helpers.js';

export const splitBillsRouter = Router();

const include = { participants: { orderBy: { name: 'asc' as const } } };

async function visibleSplit(uid: string, id: string) {
  const split = await prisma.splitBill.findFirst({
    where: { id, OR: [{ creatorId: uid }, { participants: { some: { userId: uid } } }] },
    include,
  });
  if (!split) throw notFound('Split bill');
  return split;
}

splitBillsRouter.get('/split-bills', async (req, res) => {
  const uid = userId(req);
  const splits = await prisma.splitBill.findMany({
    where: { OR: [{ creatorId: uid }, { participants: { some: { userId: uid } } }] },
    include,
    orderBy: { createdAt: 'desc' },
  });
  const views = splits.map((s) => serialize.split(s, uid));
  res.json({
    items: views,
    summary: {
      youOwe: Number(views.filter((v) => !v.isCreator && v.myShare && !v.myShare.paid).reduce((s, v) => s + (v.myShare?.amount ?? 0), 0).toFixed(2)),
      owedToYou: Number(
        views
          .filter((v) => v.isCreator)
          .reduce((s, v) => s + v.participants.filter((p) => !p.paid && p.userId !== uid).reduce((a, p) => a + p.amount, 0), 0)
          .toFixed(2),
      ),
    },
  });
});

splitBillsRouter.post('/split-bills', async (req, res) => {
  const input = body(
    req,
    z.object({
      title: z.string().trim().min(1).max(60),
      totalAmount: money,
      accountId: z.string().uuid().optional(),
      includeMe: z.boolean().default(true),
      participants: z
        .array(z.object({ email: z.string().trim().toLowerCase().optional(), name: z.string().trim().max(60).optional(), amount: money.optional() }))
        .min(1)
        .max(20),
    }),
  );
  const uid = userId(req);
  const creator = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  const account = await defaultAccount(uid, input.accountId);

  // Resolve participants: emails of PocketBank customers become linked users, others are tracked by name.
  const resolved = await Promise.all(
    input.participants.map(async (p) => {
      const user = p.email ? await prisma.user.findUnique({ where: { email: p.email } }) : null;
      if (!user && !p.name) throw badRequest(`No PocketBank customer with email ${p.email}; give a name to track them manually`);
      if (user?.id === uid) throw badRequest('Do not add yourself as a participant');
      return { userId: user?.id ?? null, name: user ? `${user.firstName} ${user.lastName}` : (p.name as string), email: p.email ?? null, amount: p.amount };
    }),
  );
  const people = input.includeMe ? [{ userId: uid, name: `${creator.firstName} ${creator.lastName}`, email: creator.email, amount: undefined }, ...resolved] : resolved;
  const total = toMoney(input.totalAmount);
  const fixed = people.filter((p) => p.amount !== undefined).reduce((s, p) => s.plus(p.amount as number), dec(0));
  const flexible = people.filter((p) => p.amount === undefined);
  if (fixed.gt(total)) throw unprocessable('SPLIT_TOO_HIGH', 'Shares add up to more than the total');
  if (flexible.length === 0 && !fixed.eq(total)) throw unprocessable('SPLIT_MISMATCH', 'Shares must add up to the total');
  // Even split of what is left; the rounding remainder goes to the first flexible share.
  const even = flexible.length ? total.minus(fixed).div(flexible.length).toDecimalPlaces(2, 1) : dec(0);
  const remainder = flexible.length ? total.minus(fixed).minus(even.mul(flexible.length)) : dec(0);
  let first = true;
  const shares = people.map((p) => {
    let amount = p.amount !== undefined ? dec(p.amount) : even;
    if (p.amount === undefined && first) {
      amount = amount.plus(remainder);
      first = false;
    }
    return { ...p, amount, paid: p.userId === uid, paidAt: p.userId === uid ? new Date() : null };
  });

  const split = await prisma.splitBill.create({
    data: {
      creatorId: uid,
      accountId: account.id,
      title: input.title,
      totalAmount: total,
      currency: account.currency,
      participants: { create: shares.map((s) => ({ userId: s.userId, name: s.name, email: s.email, amount: s.amount, paid: s.paid, paidAt: s.paidAt })) },
    },
    include,
  });
  for (const s of shares.filter((x) => x.userId && x.userId !== uid)) {
    void notify(s.userId as string, 'split', `${maskName(creator.firstName, creator.lastName)} split "${input.title}"`, `Your share is ${s.amount.toFixed(2)} ${account.currency}`, { splitBillId: split.id });
  }
  res.status(201).json(serialize.split(split, uid));
});

/** A linked participant pays their share straight into the creator's account. */
splitBillsRouter.post('/split-bills/:id/settle', idempotent, async (req, res) => {
  const input = body(req, z.object({ accountId: z.string().uuid().optional() }));
  const uid = userId(req);
  const split = await visibleSplit(uid, param(req.params.id));
  const share = split.participants.find((p) => p.userId === uid);
  if (!share) throw forbidden('You are not part of this split');
  if (share.paid) throw conflict('Your share is already settled');
  const from = await defaultAccount(uid, input.accountId);
  const to = await prisma.account.findUniqueOrThrow({ where: { id: split.accountId } });
  const [payer, creator] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: uid } }), prisma.user.findUniqueOrThrow({ where: { id: split.creatorId } })]);
  await transfer({
    from,
    to,
    amount: Number(share.amount),
    outKind: 'SPLIT_SETTLEMENT',
    inKind: 'SPLIT_SETTLEMENT',
    description: `Split · ${split.title}`,
    category: 'Other',
    counterpartyOut: maskName(creator.firstName, creator.lastName),
    counterpartyIn: maskName(payer.firstName, payer.lastName),
    extra: async (tx) => {
      const claimed = await tx.splitParticipant.updateMany({ where: { id: share.id, paid: false }, data: { paid: true, paidAt: new Date() } });
      if (claimed.count === 0) throw conflict('Your share is already settled');
    },
  });
  const updated = await settleIfDone(split.id);
  void notify(split.creatorId, 'split', `${maskName(payer.firstName, payer.lastName)} paid their share`, `${Number(share.amount).toFixed(2)} for "${split.title}"`, { splitBillId: split.id });
  res.json(serialize.split(updated, uid));
});

/** The creator marks someone (for example a non-customer who paid cash) as settled. */
splitBillsRouter.post('/split-bills/:id/participants/:pid/mark-paid', async (req, res) => {
  const uid = userId(req);
  const split = await visibleSplit(uid, param(req.params.id));
  if (split.creatorId !== uid) throw forbidden('Only the creator can mark shares as paid');
  const share = split.participants.find((p) => p.id === param(req.params.pid));
  if (!share) throw notFound('Participant');
  await prisma.splitParticipant.update({ where: { id: share.id }, data: { paid: true, paidAt: new Date() } });
  res.json(serialize.split(await settleIfDone(split.id), uid));
});

splitBillsRouter.post('/split-bills/:id/remind', async (req, res) => {
  const uid = userId(req);
  const split = await visibleSplit(uid, param(req.params.id));
  if (split.creatorId !== uid) throw forbidden('Only the creator can send reminders');
  const unpaid = split.participants.filter((p) => !p.paid && p.userId && p.userId !== uid);
  for (const p of unpaid) void notify(p.userId as string, 'split', `Reminder: "${split.title}"`, `You still owe ${Number(p.amount).toFixed(2)} ${split.currency}`, { splitBillId: split.id });
  res.json({ reminded: unpaid.length });
});

splitBillsRouter.delete('/split-bills/:id', async (req, res) => {
  const uid = userId(req);
  const split = await visibleSplit(uid, param(req.params.id));
  if (split.creatorId !== uid) throw forbidden('Only the creator can delete a split');
  if (split.participants.some((p) => p.paid && p.userId !== uid)) throw conflict('Someone already paid; the split cannot be deleted');
  await prisma.splitBill.delete({ where: { id: split.id } });
  res.status(204).end();
});

async function settleIfDone(id: string) {
  const split = await prisma.splitBill.findUniqueOrThrow({ where: { id }, include });
  if (split.participants.every((p) => p.paid) && split.status !== 'SETTLED') {
    return prisma.splitBill.update({ where: { id }, data: { status: 'SETTLED' }, include });
  }
  return split;
}
