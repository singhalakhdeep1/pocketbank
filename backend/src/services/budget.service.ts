import type { BudgetCategory } from '../generated/prisma/client.js';
import type { BudgetPeriod, TxKind } from '../generated/prisma/enums.js';
import { logger, prisma } from '../lib/infra.js';
import { num } from '../lib/money.js';
import { notify } from './notification.service.js';

/** Debit kinds that count as spending (moving money between your own accounts or into investments does not). */
export const SPENDING_KINDS: TxKind[] = ['BILL_PAYMENT', 'CARD_PURCHASE', 'QR_PAYMENT', 'P2P_OUT', 'SPLIT_SETTLEMENT', 'FEE', 'WITHDRAWAL'];

export function periodRange(period: BudgetPeriod, at = new Date(), offset = 0): { start: Date; end: Date } {
  if (period === 'WEEKLY') {
    const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
    const weekday = (start.getUTCDay() + 6) % 7; // Monday = 0
    start.setUTCDate(start.getUTCDate() - weekday + offset * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }
  if (period === 'YEARLY') {
    const year = at.getUTCFullYear() + offset;
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
  }
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + offset, 1));
  return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) };
}

async function spentBetween(userId: string, category: string, start: Date, end: Date): Promise<number> {
  const agg = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      account: { userId },
      direction: 'DEBIT',
      status: 'COMPLETED',
      kind: { in: SPENDING_KINDS },
      category: { equals: category, mode: 'insensitive' },
      createdAt: { gte: start, lt: end },
    },
  });
  return num(agg._sum.amount);
}

export interface BudgetView {
  id: string;
  name: string;
  icon: string;
  color: string;
  limit: number;
  effectiveLimit: number;
  rolledOver: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  period: BudgetPeriod;
  periodStart: string;
  periodEnd: string;
  rollover: boolean;
  alertThreshold: number;
  dailyAllowance: number;
  isOverBudget: boolean;
}

export async function budgetView(budget: BudgetCategory, at = new Date()): Promise<BudgetView> {
  const { start, end } = periodRange(budget.period, at);
  const limit = num(budget.limit);
  const spent = await spentBetween(budget.userId, budget.name, start, end);
  let rolledOver = 0;
  if (budget.rollover) {
    const prev = periodRange(budget.period, at, -1);
    if (prev.start >= new Date(budget.createdAt.getFullYear(), budget.createdAt.getMonth(), 1)) {
      rolledOver = Math.max(0, limit - (await spentBetween(budget.userId, budget.name, prev.start, prev.end)));
    }
  }
  const effectiveLimit = limit + rolledOver;
  const daysLeft = Math.max(1, Math.ceil((end.getTime() - at.getTime()) / 86_400_000));
  const remaining = Number((effectiveLimit - spent).toFixed(2));
  return {
    id: budget.id,
    name: budget.name,
    icon: budget.icon,
    color: budget.color,
    limit,
    effectiveLimit,
    rolledOver,
    spent,
    remaining,
    percentUsed: effectiveLimit > 0 ? Number(((spent / effectiveLimit) * 100).toFixed(1)) : 0,
    period: budget.period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    rollover: budget.rollover,
    alertThreshold: budget.alertThreshold,
    dailyAllowance: Number(Math.max(0, remaining / daysLeft).toFixed(2)),
    isOverBudget: spent > effectiveLimit,
  };
}

/** Sends one alert per budget per period when spending crosses the threshold, and one when it goes over. */
export async function checkBudgetAlerts(userId: string, category: string): Promise<void> {
  try {
    const budgets = await prisma.budgetCategory.findMany({
      where: { userId, name: { equals: category, mode: 'insensitive' } },
    });
    for (const budget of budgets) {
      const view = await budgetView(budget);
      const level = view.isOverBudget ? 'over' : view.percentUsed >= budget.alertThreshold ? 'threshold' : null;
      if (!level) continue;
      const key = `${view.periodStart.slice(0, 10)}:${level}`;
      if (budget.lastAlertKey === key) continue;
      await prisma.budgetCategory.update({ where: { id: budget.id }, data: { lastAlertKey: key } });
      await notify(
        userId,
        'budget',
        level === 'over' ? `${budget.name} budget exceeded` : `${budget.name} budget at ${Math.round(view.percentUsed)}%`,
        `Spent ${view.spent.toFixed(2)} of ${view.effectiveLimit.toFixed(2)} this ${budget.period.toLowerCase().replace('ly', '')}`,
        { budgetId: budget.id },
      );
    }
  } catch (err) {
    logger.logError('Budget alert check failed', err, { userId, category });
  }
}
