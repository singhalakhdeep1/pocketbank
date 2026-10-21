/**
 * Background jobs: scheduled/recurring payments, bill autopay and reminders, monthly savings
 * interest and daily portfolio snapshots. With Redis a lock makes sure only one API instance runs
 * each tick.
 */
import { config } from '../config.js';
import { logger, prisma, redis } from '../lib/infra.js';
import { toMoney } from '../lib/money.js';
import { schedulerRuns } from '../metrics.js';
import { payBill } from '../routes/bills.js';
import { defaultAccount, nextOccurrence } from '../routes/helpers.js';
import { snapshot } from '../routes/investments.js';
import { sendMoney } from '../routes/transfers.js';
import { external } from './ledger.service.js';
import { notify } from './notification.service.js';

async function acquireLock(ttlMs: number): Promise<boolean> {
  if (!redis) return true;
  return (await redis.set('pb:lock:scheduler', String(process.pid), 'PX', ttlMs, 'NX')) === 'OK';
}

async function job(name: string, fn: () => Promise<number>) {
  try {
    const count = await fn();
    schedulerRuns.inc({ job: name, result: 'ok' });
    if (count > 0) logger.logInformation('Scheduler job ran', { job: name, processed: count });
  } catch (err) {
    schedulerRuns.inc({ job: name, result: 'error' });
    logger.logError('Scheduler job failed', err, { job: name });
  }
}

export async function runScheduledPayments(now = new Date()): Promise<number> {
  const due = await prisma.scheduledPayment.findMany({ where: { active: true, nextRunAt: { lte: now } }, take: 100 });
  for (const item of due) {
    try {
      const from = await prisma.account.findUniqueOrThrow({ where: { id: item.fromAccountId } });
      if (item.kind === 'BILL') {
        const bill = await prisma.bill.findUniqueOrThrow({ where: { id: item.billId as string } });
        await payBill({ ...bill, amount: item.amount }, from);
      } else {
        const to = await prisma.account.findUniqueOrThrow({ where: { accountNumber: item.toAccountNumber as string }, include: { user: true } });
        await sendMoney(item.userId, from, to, Number(item.amount), null, item.description);
      }
      const next = nextOccurrence(item.nextRunAt, item.frequency);
      const finished = !next || (item.endDate !== null && next > item.endDate);
      await prisma.scheduledPayment.update({
        where: { id: item.id },
        data: { runCount: { increment: 1 }, lastRunAt: now, lastError: null, active: !finished, ...(next ? { nextRunAt: next } : {}) },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Retry the next day; the customer is told so they can top up.
      await prisma.scheduledPayment.update({ where: { id: item.id }, data: { lastError: message, nextRunAt: new Date(now.getTime() + 86_400_000) } });
      void notify(item.userId, 'bill', 'Scheduled payment failed', `${item.description}: ${message}. We will retry tomorrow.`, { scheduledPaymentId: item.id });
    }
  }
  return due.length;
}

export async function runAutopay(now = new Date()): Promise<number> {
  const bills = await prisma.bill.findMany({ where: { autoPay: true, status: { not: 'PAID' }, dueDate: { lte: now } }, take: 100 });
  for (const bill of bills) {
    try {
      const account = await defaultAccount(bill.userId, bill.accountId);
      await payBill(bill, account);
      void notify(bill.userId, 'bill', 'Bill paid automatically', `${bill.name} · ${Number(bill.amount).toFixed(2)}`, { billId: bill.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void notify(bill.userId, 'bill', 'Autopay failed', `${bill.name}: ${message}`, { billId: bill.id });
    }
  }
  return bills.length;
}

export async function runBillReminders(now = new Date()): Promise<number> {
  const soon = new Date(now.getTime() + 3 * 86_400_000);
  const bills = await prisma.bill.findMany({ where: { status: { not: 'PAID' }, dueDate: { lte: soon } }, take: 200 });
  let sent = 0;
  for (const bill of bills) {
    if (bill.reminderSentFor?.getTime() === bill.dueDate.getTime()) continue;
    await prisma.bill.update({ where: { id: bill.id }, data: { reminderSentFor: bill.dueDate } });
    const overdue = bill.dueDate < now;
    void notify(
      bill.userId,
      'bill',
      overdue ? `${bill.name} is overdue` : `${bill.name} is due soon`,
      `${Number(bill.amount).toFixed(2)} due ${bill.dueDate.toISOString().slice(0, 10)}${bill.autoPay ? ' (autopay on)' : ''}`,
      { billId: bill.id },
    );
    sent++;
  }
  return sent;
}

/** Posts last month's interest on savings accounts once (reference interest:<account>:<YYYY-MM>). */
export async function runInterest(now = new Date()): Promise<number> {
  const period = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const label = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}`;
  const accounts = await prisma.account.findMany({ where: { type: 'SAVINGS', status: 'ACTIVE', interestRate: { gt: 0 }, balance: { gt: 0 }, createdAt: { lt: new Date(now.getFullYear(), now.getMonth(), 1) } } });
  let posted = 0;
  for (const account of accounts) {
    const reference = `interest:${account.id}:${label}`;
    if (await prisma.transaction.findFirst({ where: { reference } })) continue;
    const interest = toMoney(account.balance.mul(account.interestRate).div(12));
    if (interest.lt(0.01)) continue;
    await external(account, 'CREDIT', interest, { kind: 'INTEREST', description: `Interest ${label}`, category: 'Income', reference });
    posted++;
  }
  return posted;
}

export async function runSnapshots(): Promise<number> {
  const users = await prisma.holding.findMany({ distinct: ['userId'], select: { userId: true } });
  const day = new Date(new Date().toISOString().slice(0, 10));
  let done = 0;
  for (const { userId } of users) {
    if (await prisma.portfolioSnapshot.findUnique({ where: { userId_day: { userId, day } } })) continue;
    await snapshot(userId);
    done++;
  }
  return done;
}

export async function tick(): Promise<void> {
  if (!(await acquireLock(Math.max(5_000, config.schedulerIntervalMs - 1_000)))) return;
  await logger.runWithContext({ correlationId: `scheduler-${Date.now()}` }, async () => {
    await job('scheduled_payments', () => runScheduledPayments());
    await job('autopay', () => runAutopay());
    await job('bill_reminders', () => runBillReminders());
    await job('interest', () => runInterest());
    await job('portfolio_snapshots', () => runSnapshots());
  });
}

let timer: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (!config.schedulerEnabled || timer) return;
  timer = setInterval(() => void tick(), config.schedulerIntervalMs);
  setTimeout(() => void tick(), 3_000);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
