import type {
  Account,
  Bill,
  Card,
  Notification,
  Payee,
  ScheduledPayment,
  SplitBill,
  SplitParticipant,
  Transaction,
  User,
} from '../generated/prisma/client.js';
import { num } from './money.js';

export const user = (u: User) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  phone: u.phone,
  role: u.role,
  twoFactorEnabled: u.twoFactorEnabled,
  language: u.language,
  notifications: { transactions: u.notifyTransactions, security: u.notifySecurity, budget: u.notifyBudget },
  pushRegistered: Boolean(u.pushToken),
  createdAt: u.createdAt,
});

export const account = (a: Account) => ({
  id: a.id,
  accountNumber: a.accountNumber,
  accountType: a.type,
  nickname: a.nickname,
  balance: num(a.balance),
  currency: a.currency,
  status: a.status,
  interestRate: Number(a.interestRate),
  createdAt: a.createdAt,
});

export const transaction = (t: Transaction) => ({
  id: t.id,
  accountId: t.accountId,
  direction: t.direction,
  type: t.kind,
  amount: num(t.amount),
  signedAmount: t.direction === 'DEBIT' ? -num(t.amount) : num(t.amount),
  balanceAfter: num(t.balanceAfter),
  currency: t.currency,
  description: t.description,
  merchant: t.merchant,
  category: t.category,
  notes: t.notes,
  tags: t.tags,
  status: t.status,
  reference: t.reference,
  counterparty: t.counterparty,
  cardId: t.cardId,
  hasReceipt: Boolean(t.receiptPath),
  fxRate: t.fxRate === null ? null : Number(t.fxRate),
  createdAt: t.createdAt,
});

export const card = (c: Card) => ({
  id: c.id,
  accountId: c.accountId,
  kind: c.kind,
  network: c.network,
  type: c.type,
  last4: c.last4,
  maskedNumber: `•••• •••• •••• ${c.last4}`,
  expiry: `${String(c.expiryMonth).padStart(2, '0')}/${String(c.expiryYear).slice(-2)}`,
  cardholder: c.cardholder,
  label: c.label,
  status: c.status,
  dailyLimit: num(c.dailyLimit),
  monthlyLimit: num(c.monthlyLimit),
  onlineEnabled: c.onlineEnabled,
  contactlessEnabled: c.contactlessEnabled,
  createdAt: c.createdAt,
});

export const bill = (b: Bill) => {
  const overdue = b.status !== 'PAID' && b.dueDate.getTime() < Date.now();
  return {
    id: b.id,
    accountId: b.accountId,
    name: b.name,
    payee: b.payee,
    category: b.category,
    amount: num(b.amount),
    dueDate: b.dueDate,
    recurrence: b.recurrence,
    status: overdue ? 'OVERDUE' : b.status,
    autoPay: b.autoPay,
    lastPaidAt: b.lastPaidAt,
  };
};

export const scheduled = (s: ScheduledPayment) => ({
  id: s.id,
  kind: s.kind,
  fromAccountId: s.fromAccountId,
  toAccountNumber: s.toAccountNumber,
  billId: s.billId,
  amount: num(s.amount),
  description: s.description,
  frequency: s.frequency,
  nextRunAt: s.nextRunAt,
  endDate: s.endDate,
  active: s.active,
  runCount: s.runCount,
  lastRunAt: s.lastRunAt,
  lastError: s.lastError,
});

export const payee = (p: Payee) => ({ id: p.id, name: p.name, accountNumber: p.accountNumber, lastUsedAt: p.lastUsedAt });

export const split = (s: SplitBill & { participants: SplitParticipant[] }, viewerId: string) => {
  const mine = s.participants.find((p) => p.userId === viewerId);
  return {
    id: s.id,
    title: s.title,
    totalAmount: num(s.totalAmount),
    currency: s.currency,
    status: s.status,
    createdBy: s.creatorId,
    isCreator: s.creatorId === viewerId,
    createdAt: s.createdAt,
    myShare: mine ? { amount: num(mine.amount), paid: mine.paid } : null,
    participants: s.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      email: p.email,
      amount: num(p.amount),
      paid: p.paid,
      paidAt: p.paidAt,
    })),
  };
};

export const notification = (n: Notification) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  data: n.data,
  read: n.read,
  createdAt: n.createdAt,
});
