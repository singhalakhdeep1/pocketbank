import { Router } from 'express';
import { z } from 'zod';
import { cache, prisma } from '../lib/infra.js';
import { num } from '../lib/money.js';
import * as serialize from '../lib/serialize.js';
import { userId } from '../middleware/auth.js';
import { SPENDING_KINDS, budgetView } from '../services/budget.service.js';
import { quotes } from '../services/market-data.service.js';
import { INCOME_KINDS } from '../services/report.service.js';

export const analyticsRouter = Router();

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rangeStart(range: 'week' | 'month' | 'year', offset = 0) {
  const now = new Date();
  if (range === 'week') return new Date(now.getTime() - (7 * (1 + offset)) * 86_400_000);
  if (range === 'year') return new Date(now.getFullYear() - offset, 0, 1);
  return new Date(now.getFullYear(), now.getMonth() - offset, 1);
}

async function sumSpending(uid: string, from: Date, to: Date) {
  const agg = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { account: { userId: uid }, direction: 'DEBIT', status: 'COMPLETED', kind: { in: SPENDING_KINDS }, createdAt: { gte: from, lt: to } },
  });
  return num(agg._sum.amount);
}

analyticsRouter.get('/analytics/spending', async (req, res) => {
  const { range } = z.object({ range: z.enum(['week', 'month', 'year']).default('month') }).parse(req.query);
  const uid = userId(req);
  const data = await cache.getOrSetJson(
    `u:${uid}:spending:${range}`,
    async () => {
      const start = rangeStart(range);
      const now = new Date();
      const grouped = await prisma.transaction.groupBy({
        by: ['category'],
        _sum: { amount: true },
        where: { account: { userId: uid }, direction: 'DEBIT', status: 'COMPLETED', kind: { in: SPENDING_KINDS }, createdAt: { gte: start } },
      });
      const totalSpent = grouped.reduce((s, g) => s + num(g._sum.amount), 0);
      const categories = grouped
        .map((g) => ({ name: g.category, amount: num(g._sum.amount) }))
        .sort((a, b) => b.amount - a.amount)
        .map((c, i) => ({ ...c, percentage: totalSpent ? Number(((c.amount / totalSpent) * 100).toFixed(1)) : 0, color: COLORS[i % COLORS.length] }));

      const budgets = await prisma.budgetCategory.findMany({ where: { userId: uid } });
      // Convert every budget to a monthly amount, then scale to the requested range.
      const monthly = budgets.reduce((s, b) => s + num(b.limit) * (b.period === 'WEEKLY' ? 52 / 12 : b.period === 'YEARLY' ? 1 / 12 : 1), 0);
      const budget = monthly * (range === 'week' ? 12 / 52 : range === 'year' ? 12 : 1);

      const monthlyTrend: { month: string; amount: number; income: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const income = await prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { account: { userId: uid }, direction: 'CREDIT', kind: { in: INCOME_KINDS }, createdAt: { gte: from, lt: to } },
        });
        monthlyTrend.push({ month: MONTHS[from.getMonth()], amount: await sumSpending(uid, from, to), income: num(income._sum.amount) });
      }
      const previousStart = rangeStart(range, 1);
      const previous = await sumSpending(uid, previousStart, start);
      return {
        range,
        totalSpent: Number(totalSpent.toFixed(2)),
        budget: Number(budget.toFixed(2)),
        previousPeriodSpent: previous,
        changeVsPrevious: previous ? Number((((totalSpent - previous) / previous) * 100).toFixed(1)) : null,
        categories,
        monthlyTrend,
      };
    },
    120,
  );
  res.json(data);
});

/** Everything the dashboard shows in one call: net worth, month cash flow, health score, recent activity. */
analyticsRouter.get('/analytics/dashboard', async (req, res) => {
  const uid = userId(req);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [accounts, holdings, recent, bills, cards, budgets, unread, incomeAgg, expenseAgg] = await Promise.all([
    prisma.account.findMany({ where: { userId: uid, status: { not: 'CLOSED' } } }),
    prisma.holding.findMany({ where: { userId: uid } }),
    prisma.transaction.findMany({ where: { account: { userId: uid } }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.bill.findMany({ where: { userId: uid, status: { not: 'PAID' } }, orderBy: { dueDate: 'asc' }, take: 3 }),
    prisma.card.count({ where: { userId: uid, status: 'ACTIVE' } }),
    prisma.budgetCategory.findMany({ where: { userId: uid } }),
    prisma.notification.count({ where: { userId: uid, read: false } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { account: { userId: uid }, direction: 'CREDIT', kind: { in: INCOME_KINDS }, createdAt: { gte: monthStart } } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { account: { userId: uid }, direction: 'DEBIT', kind: { in: SPENDING_KINDS }, createdAt: { gte: monthStart } } }),
  ]);
  const holdingQuotes = holdings.length ? await quotes(holdings.map((h) => h.symbol)) : [];
  const investmentsValue = holdings.reduce((s, h, i) => s + Number(h.quantity) * holdingQuotes[i].price, 0);
  const cryptoValue = holdings.reduce((s, h, i) => s + (h.assetType === 'CRYPTO' ? Number(h.quantity) * holdingQuotes[i].price : 0), 0);
  const cash = accounts.filter((a) => a.currency === 'USD').reduce((s, a) => s + num(a.balance), 0);
  const income = num(incomeAgg._sum.amount);
  const expenses = num(expenseAgg._sum.amount);

  // Financial health score (0-100): savings rate, budget adherence, emergency fund, no overdue bills.
  const views = await Promise.all(budgets.map((b) => budgetView(b)));
  const savingsRate = income > 0 ? (income - expenses) / income : 0;
  const adherence = views.length ? views.filter((v) => !v.isOverBudget).length / views.length : 0.5;
  const monthsCovered = expenses > 0 ? cash / expenses : cash > 0 ? 6 : 0;
  const overdue = bills.some((b) => b.dueDate < now);
  const healthScore = Math.round(
    Math.max(0, Math.min(1, savingsRate / 0.2)) * 35 + adherence * 25 + Math.min(1, monthsCovered / 6) * 30 + (overdue ? 0 : 10),
  );

  res.json({
    totalBalance: Number(cash.toFixed(2)),
    balancesByCurrency: accounts.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.currency]: Number(((acc[a.currency] ?? 0) + num(a.balance)).toFixed(2)) }), {}),
    investmentsValue: Number((investmentsValue - cryptoValue).toFixed(2)),
    cryptoValue: Number(cryptoValue.toFixed(2)),
    netWorth: Number((cash + investmentsValue).toFixed(2)),
    activeAccounts: accounts.filter((a) => a.status === 'ACTIVE').length,
    activeCards: cards,
    month: { income, expenses, net: Number((income - expenses).toFixed(2)) },
    healthScore,
    unreadNotifications: unread,
    recentTransactions: recent.map(serialize.transaction),
    upcomingBills: bills.map(serialize.bill),
    budgetsOverLimit: views.filter((v) => v.isOverBudget).map((v) => v.name),
  });
});
