import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { userId } from '../middleware/auth.js';
import { body, money } from '../middleware/validate.js';
import { SPENDING_KINDS, budgetView, periodRange } from '../services/budget.service.js';
import { param } from './helpers.js';

export const budgetsRouter = Router();

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

async function ownedBudget(uid: string, id: string) {
  const budget = await prisma.budgetCategory.findFirst({ where: { id, userId: uid } });
  if (!budget) throw notFound('Budget category');
  return budget;
}

budgetsRouter.get('/budgets', async (req, res) => {
  const budgets = await prisma.budgetCategory.findMany({ where: { userId: userId(req) }, orderBy: { createdAt: 'asc' } });
  const views = await Promise.all(budgets.map((b) => budgetView(b)));
  const totalLimit = views.reduce((s, v) => s + v.effectiveLimit, 0);
  const totalSpent = views.reduce((s, v) => s + v.spent, 0);
  res.json({
    items: views,
    summary: {
      totalLimit: Number(totalLimit.toFixed(2)),
      totalSpent: Number(totalSpent.toFixed(2)),
      remaining: Number((totalLimit - totalSpent).toFixed(2)),
      percentUsed: totalLimit ? Number(((totalSpent / totalLimit) * 100).toFixed(1)) : 0,
      overBudgetCount: views.filter((v) => v.isOverBudget).length,
    },
  });
});

const budgetSchema = z.object({
  name: z.string().trim().min(1).max(40),
  limit: money,
  icon: z.string().max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  period: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).default('MONTHLY'),
  rollover: z.boolean().default(false),
  alertThreshold: z.number().int().min(10).max(100).default(80),
});

budgetsRouter.post('/budgets', async (req, res) => {
  const input = body(req, budgetSchema);
  const uid = userId(req);
  const count = await prisma.budgetCategory.count({ where: { userId: uid } });
  const budget = await prisma.budgetCategory.create({
    data: { ...input, userId: uid, color: input.color ?? PALETTE[count % PALETTE.length], icon: input.icon ?? '💰' },
  });
  res.status(201).json(await budgetView(budget));
});

budgetsRouter.patch('/budgets/:id', async (req, res) => {
  const input = body(req, budgetSchema.partial());
  const budget = await ownedBudget(userId(req), param(req.params.id));
  const updated = await prisma.budgetCategory.update({ where: { id: budget.id }, data: { ...input, lastAlertKey: null } });
  res.json(await budgetView(updated));
});

budgetsRouter.delete('/budgets/:id', async (req, res) => {
  const budget = await ownedBudget(userId(req), param(req.params.id));
  await prisma.budgetCategory.delete({ where: { id: budget.id } });
  res.status(204).end();
});

budgetsRouter.get('/budgets/:id/transactions', async (req, res) => {
  const uid = userId(req);
  const budget = await ownedBudget(uid, param(req.params.id));
  const { start, end } = periodRange(budget.period);
  const txs = await prisma.transaction.findMany({
    where: {
      account: { userId: uid },
      direction: 'DEBIT',
      kind: { in: SPENDING_KINDS },
      category: { equals: budget.name, mode: 'insensitive' },
      createdAt: { gte: start, lt: end },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(txs.map(serialize.transaction));
});

/** Plain-language tips derived from the user's own budgets. */
budgetsRouter.get('/budgets/insights', async (req, res) => {
  const budgets = await prisma.budgetCategory.findMany({ where: { userId: userId(req) } });
  const views = await Promise.all(budgets.map((b) => budgetView(b)));
  const tips: { type: 'warning' | 'success' | 'info'; message: string }[] = [];
  for (const v of views) {
    if (v.isOverBudget) tips.push({ type: 'warning', message: `${v.name} is ${(v.percentUsed - 100).toFixed(0)}% over budget. Consider cutting back until ${v.periodEnd.slice(0, 10)}.` });
    else if (v.percentUsed >= v.alertThreshold) tips.push({ type: 'warning', message: `${v.name} is at ${v.percentUsed.toFixed(0)}%. About ${v.dailyAllowance.toFixed(2)} per day is left.` });
    else if (v.percentUsed < 50) tips.push({ type: 'success', message: `Great job: ${v.name} is only at ${v.percentUsed.toFixed(0)}% of its limit.` });
  }
  if (views.length === 0) tips.push({ type: 'info', message: 'Create budget categories to track spending against limits.' });
  res.json(tips);
});
