import PDFDocument from 'pdfkit';
import type { Transaction } from '../generated/prisma/client.js';
import type { TxKind } from '../generated/prisma/enums.js';
import { prisma } from '../lib/infra.js';
import { num } from '../lib/money.js';
import { SPENDING_KINDS } from './budget.service.js';

export const INCOME_KINDS: TxKind[] = ['DEPOSIT', 'P2P_IN', 'TOPUP', 'INTEREST', 'SPLIT_SETTLEMENT'];
const DEDUCTIBLE = ['charity', 'donations', 'medical', 'health', 'education'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function userTransactions(userId: string, start: Date, end: Date) {
  return prisma.transaction.findMany({
    where: { account: { userId }, status: 'COMPLETED', createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: 'asc' },
  });
}

const isIncome = (t: Transaction) => t.direction === 'CREDIT' && INCOME_KINDS.includes(t.kind);
const isExpense = (t: Transaction) => t.direction === 'DEBIT' && SPENDING_KINDS.includes(t.kind);
const round = (v: number) => Number(v.toFixed(2));

function breakdown(txs: Transaction[]) {
  const totals = new Map<string, number>();
  for (const t of txs.filter(isExpense)) totals.set(t.category, (totals.get(t.category) ?? 0) + num(t.amount));
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount: round(amount), percentage: sum ? round((amount / sum) * 100) : 0 }));
}

function topMerchants(txs: Transaction[], limit = 5) {
  const totals = new Map<string, { amount: number; count: number }>();
  for (const t of txs.filter(isExpense)) {
    const key = t.merchant ?? t.description;
    const entry = totals.get(key) ?? { amount: 0, count: 0 };
    entry.amount += num(t.amount);
    entry.count++;
    totals.set(key, entry);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, limit)
    .map(([merchant, v]) => ({ merchant, amount: round(v.amount), count: v.count }));
}

export async function monthlyReport(userId: string, year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const txs = await userTransactions(userId, start, end);
  const income = round(txs.filter(isIncome).reduce((s, t) => s + num(t.amount), 0));
  const expenses = round(txs.filter(isExpense).reduce((s, t) => s + num(t.amount), 0));
  const savings = round(income - expenses);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    type: 'monthly' as const,
    period: { year, month, label: `${MONTHS[month - 1]} ${year}`, start, end },
    income,
    expenses,
    savings,
    savingsRate: income ? round((savings / income) * 100) : 0,
    dailyAverage: round(expenses / days),
    transactionCount: txs.length,
    categoryBreakdown: breakdown(txs),
    topMerchants: topMerchants(txs),
    transactions: txs,
  };
}

export async function annualReport(userId: string, year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const txs = await userTransactions(userId, start, end);
  const months = MONTHS.map((label, i) => {
    const inMonth = txs.filter((t) => t.createdAt.getUTCMonth() === i);
    const income = round(inMonth.filter(isIncome).reduce((s, t) => s + num(t.amount), 0));
    const expenses = round(inMonth.filter(isExpense).reduce((s, t) => s + num(t.amount), 0));
    return { month: i + 1, label, income, expenses, net: round(income - expenses) };
  });
  const income = round(months.reduce((s, m) => s + m.income, 0));
  const expenses = round(months.reduce((s, m) => s + m.expenses, 0));
  return {
    type: 'annual' as const,
    period: { year, label: String(year), start, end },
    income,
    expenses,
    savings: round(income - expenses),
    savingsRate: income ? round(((income - expenses) / income) * 100) : 0,
    months,
    categoryBreakdown: breakdown(txs),
    topMerchants: topMerchants(txs, 10),
    transactionCount: txs.length,
    transactions: txs,
  };
}

export async function taxReport(userId: string, year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const [txs, sells] = await Promise.all([
    userTransactions(userId, start, end),
    prisma.trade.findMany({ where: { userId, side: 'SELL', createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'asc' } }),
  ]);
  const interest = round(txs.filter((t) => t.kind === 'INTEREST').reduce((s, t) => s + num(t.amount), 0));
  const realized = sells.map((s) => ({
    date: s.createdAt,
    symbol: s.symbol,
    assetType: s.assetType,
    quantity: Number(s.quantity),
    proceeds: num(s.total),
    gain: num(s.realizedGain),
  }));
  const deductibleTxs = txs.filter((t) => isExpense(t) && DEDUCTIBLE.includes(t.category.toLowerCase()));
  const deductible = breakdown(deductibleTxs);
  return {
    type: 'tax' as const,
    period: { year, label: `Tax year ${year}`, start, end },
    interestIncome: interest,
    capitalGains: {
      total: round(realized.reduce((s, r) => s + r.gain, 0)),
      gains: round(realized.filter((r) => r.gain > 0).reduce((s, r) => s + r.gain, 0)),
      losses: round(realized.filter((r) => r.gain < 0).reduce((s, r) => s + r.gain, 0)),
      trades: realized,
    },
    potentiallyDeductible: { total: round(deductible.reduce((s, d) => s + d.amount, 0)), categories: deductible },
    disclaimer: 'Informational summary only, not tax advice.',
    transactions: [...txs.filter((t) => t.kind === 'INTEREST'), ...deductibleTxs],
  };
}

export type Report = Awaited<ReturnType<typeof monthlyReport | typeof annualReport | typeof taxReport>>;

// ---------------- rendering ----------------

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function transactionsCsv(txs: Transaction[]): string {
  const header = ['date', 'description', 'merchant', 'category', 'type', 'direction', 'amount', 'currency', 'balance_after', 'status', 'reference', 'notes', 'tags'];
  const rows = txs.map((t) =>
    [
      t.createdAt.toISOString(),
      t.description,
      t.merchant,
      t.category,
      t.kind,
      t.direction,
      (t.direction === 'DEBIT' ? -1 : 1) * num(t.amount),
      t.currency,
      num(t.balanceAfter),
      t.status,
      t.reference,
      t.notes,
      t.tags.join('|'),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n') + '\n';
}

export function reportCsv(report: Report): string {
  const lines: string[] = [`PocketBank ${report.type} report,${csvCell(report.period.label)}`];
  if (report.type === 'tax') {
    lines.push(`interest_income,${report.interestIncome}`, `capital_gains_total,${report.capitalGains.total}`, `potentially_deductible,${report.potentiallyDeductible.total}`);
    lines.push('', 'date,symbol,quantity,proceeds,gain');
    report.capitalGains.trades.forEach((t) => lines.push([t.date.toISOString(), t.symbol, t.quantity, t.proceeds, t.gain].map(csvCell).join(',')));
  } else {
    lines.push(`income,${report.income}`, `expenses,${report.expenses}`, `savings,${report.savings}`, `savings_rate,${report.savingsRate}`);
    if (report.type === 'annual') {
      lines.push('', 'month,income,expenses,net');
      report.months.forEach((m) => lines.push([m.label, m.income, m.expenses, m.net].join(',')));
    }
    lines.push('', 'category,amount,percentage');
    report.categoryBreakdown.forEach((c) => lines.push([csvCell(c.category), c.amount, c.percentage].join(',')));
  }
  lines.push('', transactionsCsv(report.transactions));
  return lines.join('\n');
}

export function pdfBuffer(title: string, render: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: title, Author: 'PocketBank' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fillColor('#1976d2').fontSize(20).text('PocketBank', { continued: true }).fillColor('#333').fontSize(12).text(`   ${title}`);
    doc.moveDown(0.3).fontSize(8).fillColor('#888').text(`Generated ${new Date().toISOString()}`).moveDown();
    doc.fillColor('#000');
    render(doc);
    doc.end();
  });
}

function txTable(doc: PDFKit.PDFDocument, txs: Transaction[]) {
  doc.fontSize(11).text('Transactions', { underline: true }).moveDown(0.3).fontSize(8);
  if (txs.length === 0) doc.text('No transactions in this period.');
  for (const t of txs.slice(0, 500)) {
    const amount = `${t.direction === 'DEBIT' ? '-' : '+'}${num(t.amount).toFixed(2)} ${t.currency}`;
    doc.text(`${t.createdAt.toISOString().slice(0, 10)}  ${t.description.slice(0, 48).padEnd(48)}  ${t.category.slice(0, 14).padEnd(14)}  ${amount}`, { lineGap: 1 });
  }
  if (txs.length > 500) doc.text(`… ${txs.length - 500} more rows in the CSV export`);
}

export function reportPdf(report: Report): Promise<Buffer> {
  return pdfBuffer(`${report.period.label} ${report.type} report`, (doc) => {
    doc.fontSize(11);
    if (report.type === 'tax') {
      doc.text(`Interest income: ${report.interestIncome.toFixed(2)}`);
      doc.text(`Realized capital gains: ${report.capitalGains.total.toFixed(2)} (gains ${report.capitalGains.gains.toFixed(2)}, losses ${report.capitalGains.losses.toFixed(2)})`);
      doc.text(`Potentially deductible spending: ${report.potentiallyDeductible.total.toFixed(2)}`).moveDown();
      doc.fontSize(9);
      report.capitalGains.trades.forEach((t) => doc.text(`${t.date.toISOString().slice(0, 10)}  SELL ${t.quantity} ${t.symbol}  proceeds ${t.proceeds.toFixed(2)}  gain ${t.gain.toFixed(2)}`));
      doc.moveDown().fontSize(8).fillColor('#888').text(report.disclaimer).fillColor('#000').moveDown();
    } else {
      doc.text(`Income: ${report.income.toFixed(2)}    Expenses: ${report.expenses.toFixed(2)}    Savings: ${report.savings.toFixed(2)} (${report.savingsRate}%)`).moveDown();
      if (report.type === 'annual') {
        doc.fontSize(9);
        report.months.forEach((m) => doc.text(`${m.label}:  income ${m.income.toFixed(2)}   expenses ${m.expenses.toFixed(2)}   net ${m.net.toFixed(2)}`));
        doc.moveDown();
      }
      doc.fontSize(11).text('Spending by category', { underline: true }).fontSize(9);
      report.categoryBreakdown.forEach((c) => doc.text(`${c.category}: ${c.amount.toFixed(2)} (${c.percentage}%)`));
      doc.moveDown();
    }
    txTable(doc, report.transactions);
  });
}

export function transactionsPdf(title: string, txs: Transaction[]): Promise<Buffer> {
  return pdfBuffer(title, (doc) => txTable(doc, txs));
}
