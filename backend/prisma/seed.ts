/**
 * Demo data: three customers with 90 days of history, budgets, bills, cards, holdings, a split
 * bill, saved payees and ATM/branch locations. Safe to re-run: it does nothing if the demo users
 * already exist (pass --reset to wipe and recreate them).
 *
 *   alex@pocketbank.dev / Password123   (customer, rich history)
 *   sam@pocketbank.dev  / Password123   (customer, P2P counterpart)
 *   admin@pocketbank.dev / Password123  (admin, can trigger scheduler jobs)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import type { AssetType, TxKind } from '../src/generated/prisma/enums.js';
import { encrypt, lookupHash, luhnComplete, randomDigits } from '../src/lib/security.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/pocketbank' }),
});
const D = (v: number) => new Prisma.Decimal(v.toFixed(2));
const DEMO = ['alex@pocketbank.dev', 'sam@pocketbank.dev', 'admin@pocketbank.dev'];

// Deterministic pseudo-random so every seed run produces the same history.
let seed = 42;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(rnd() * 60), 0, 0);
  return d;
};

const SPEND: { merchant: string; category: string; kind: TxKind; min: number; max: number }[] = [
  { merchant: 'Whole Foods Market', category: 'Groceries', kind: 'CARD_PURCHASE', min: 35, max: 140 },
  { merchant: "Trader Joe's", category: 'Groceries', kind: 'CARD_PURCHASE', min: 20, max: 90 },
  { merchant: 'Blue Bottle Coffee', category: 'Food & Dining', kind: 'QR_PAYMENT', min: 4, max: 12 },
  { merchant: 'Chipotle', category: 'Food & Dining', kind: 'CARD_PURCHASE', min: 11, max: 28 },
  { merchant: 'Sushi Ran', category: 'Food & Dining', kind: 'CARD_PURCHASE', min: 40, max: 120 },
  { merchant: 'Uber', category: 'Transport', kind: 'CARD_PURCHASE', min: 9, max: 42 },
  { merchant: 'Shell', category: 'Transport', kind: 'CARD_PURCHASE', min: 30, max: 70 },
  { merchant: 'Amazon', category: 'Shopping', kind: 'CARD_PURCHASE', min: 15, max: 160 },
  { merchant: 'Target', category: 'Shopping', kind: 'CARD_PURCHASE', min: 20, max: 110 },
  { merchant: 'AMC Theatres', category: 'Entertainment', kind: 'CARD_PURCHASE', min: 14, max: 45 },
  { merchant: 'Walgreens', category: 'Health', kind: 'CARD_PURCHASE', min: 8, max: 60 },
  { merchant: 'Red Cross', category: 'Charity', kind: 'CARD_PURCHASE', min: 20, max: 50 },
];

const LOCATIONS = [
  // San Francisco
  { name: 'PocketBank Market Street Branch', type: 'BRANCH', address: '1 Market St, San Francisco, CA', lat: 37.7941, lng: -122.3951, hours: 'Mon-Fri 9:00-17:00, Sat 10:00-14:00', services: ['Deposits', 'Loans', 'Safe deposit', 'Notary', 'Cash withdrawal'] },
  { name: 'PocketBank ATM · Union Square', type: 'ATM', address: '333 Post St, San Francisco, CA', lat: 37.7879, lng: -122.4075, hours: '24/7', services: ['Cash withdrawal', 'Deposits', 'Contactless'] },
  { name: 'PocketBank ATM · Mission', type: 'ATM', address: '2400 Mission St, San Francisco, CA', lat: 37.7583, lng: -122.4187, hours: '24/7', services: ['Cash withdrawal', 'Balance inquiry'] },
  { name: 'PocketBank ATM · SFO Terminal 2', type: 'ATM', address: 'San Francisco International Airport, CA', lat: 37.6164, lng: -122.3855, hours: '24/7', services: ['Cash withdrawal', 'Currency exchange'] },
  // New York
  { name: 'PocketBank Fifth Avenue Branch', type: 'BRANCH', address: '500 5th Ave, New York, NY', lat: 40.7539, lng: -73.9809, hours: 'Mon-Fri 9:00-18:00', services: ['Deposits', 'Loans', 'Wealth advice', 'Cash withdrawal'] },
  { name: 'PocketBank ATM · Times Square', type: 'ATM', address: '1560 Broadway, New York, NY', lat: 40.7589, lng: -73.9851, hours: '24/7', services: ['Cash withdrawal', 'Deposits', 'Contactless'] },
  { name: 'PocketBank ATM · Brooklyn Heights', type: 'ATM', address: '130 Court St, Brooklyn, NY', lat: 40.6895, lng: -73.9925, hours: '24/7', services: ['Cash withdrawal'] },
  // London
  { name: 'PocketBank City of London Branch', type: 'BRANCH', address: '25 Cheapside, London', lat: 51.5142, lng: -0.0931, hours: 'Mon-Fri 9:30-16:30', services: ['Deposits', 'Business banking', 'Currency exchange'] },
  { name: 'PocketBank ATM · King’s Cross', type: 'ATM', address: 'Euston Rd, London', lat: 51.5308, lng: -0.1238, hours: '24/7', services: ['Cash withdrawal', 'Contactless'] },
  // India
  { name: 'PocketBank Connaught Place Branch', type: 'BRANCH', address: 'Block A, Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167, hours: 'Mon-Sat 10:00-16:00', services: ['Deposits', 'Loans', 'Forex', 'Cash withdrawal'] },
  { name: 'PocketBank ATM · Hauz Khas', type: 'ATM', address: 'Hauz Khas Village, New Delhi', lat: 28.5535, lng: 77.1946, hours: '24/7', services: ['Cash withdrawal', 'Balance inquiry'] },
  { name: 'PocketBank Bandra Branch', type: 'BRANCH', address: 'Hill Road, Bandra West, Mumbai', lat: 19.0544, lng: 72.8315, hours: 'Mon-Sat 10:00-16:00', services: ['Deposits', 'Loans', 'Cash withdrawal'] },
  { name: 'PocketBank ATM · Koramangala', type: 'ATM', address: '80 Feet Rd, Koramangala, Bengaluru', lat: 12.9352, lng: 77.6245, hours: '24/7', services: ['Cash withdrawal', 'Deposits'] },
] as const;

async function accountNumber() {
  return `40${randomDigits(8)}`;
}

function card(userId: string, accountId: string, kind: 'PHYSICAL' | 'VIRTUAL', network: 'VISA' | 'MASTERCARD', holder: string, label: string | null) {
  const pan = luhnComplete((network === 'VISA' ? '453201' : '535522') + randomDigits(9));
  const now = new Date();
  return {
    userId,
    accountId,
    kind,
    network,
    panEncrypted: encrypt(pan),
    panHash: lookupHash(pan),
    last4: pan.slice(-4),
    expiryMonth: now.getMonth() + 1,
    expiryYear: now.getFullYear() + (kind === 'VIRTUAL' ? 3 : 4),
    cvvEncrypted: encrypt(randomDigits(3)),
    cardholder: holder.toUpperCase(),
    label,
    status: 'ACTIVE' as const,
    dailyLimit: D(kind === 'VIRTUAL' ? 500 : 1500),
    monthlyLimit: D(kind === 'VIRTUAL' ? 2000 : 6000),
  };
}

type Leg = { at: Date; direction: 'CREDIT' | 'DEBIT'; kind: TxKind; amount: number; description: string; category: string; merchant?: string; counterparty?: string; cardId?: string; reference?: string };

/** Writes legs in date order with running balances and returns the final balance. */
async function writeHistory(accountId: string, currency: string, legs: Leg[]) {
  legs.sort((a, b) => a.at.getTime() - b.at.getTime());
  let balance = 0;
  const rows = legs.map((l) => {
    balance += l.direction === 'CREDIT' ? l.amount : -l.amount;
    return {
      accountId,
      direction: l.direction,
      kind: l.kind,
      amount: D(l.amount),
      balanceAfter: D(balance),
      currency,
      description: l.description,
      category: l.category,
      merchant: l.merchant ?? null,
      counterparty: l.counterparty ?? null,
      cardId: l.cardId ?? null,
      reference: l.reference ?? randomUUID(),
      createdAt: l.at,
    };
  });
  await prisma.transaction.createMany({ data: rows });
  await prisma.account.update({ where: { id: accountId }, data: { balance: D(balance) } });
  return balance;
}

async function main() {
  const reset = process.argv.includes('--reset');
  if (reset) await prisma.user.deleteMany({ where: { email: { in: DEMO } } });
  if (await prisma.user.findUnique({ where: { email: DEMO[0] } })) {
    console.log('Demo data already present (use --reset to recreate).');
  } else {
    await seedUsers();
  }
  if ((await prisma.location.count()) === 0) {
    await prisma.location.createMany({ data: LOCATIONS.map((l) => ({ ...l, services: [...l.services] })) });
    console.log(`Seeded ${LOCATIONS.length} ATM/branch locations.`);
  }
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash('Password123', 12);
  const alex = await prisma.user.create({ data: { email: DEMO[0], passwordHash, firstName: 'Alex', lastName: 'Morgan', phone: '+1 415 555 0134' } });
  const sam = await prisma.user.create({ data: { email: DEMO[1], passwordHash, firstName: 'Sam', lastName: 'Rivera', phone: '+1 415 555 0177' } });
  const admin = await prisma.user.create({ data: { email: DEMO[2], passwordHash, firstName: 'Ada', lastName: 'Admin', role: 'ADMIN' } });

  const [aChk, aSav, aEur] = await Promise.all([
    prisma.account.create({ data: { createdAt: daysAgo(95), userId: alex.id, type: 'CHECKING', accountNumber: await accountNumber(), nickname: 'Everyday' } }),
    prisma.account.create({ data: { createdAt: daysAgo(95), userId: alex.id, type: 'SAVINGS', accountNumber: await accountNumber(), nickname: 'Rainy day', interestRate: new Prisma.Decimal('0.02') } }),
    prisma.account.create({ data: { createdAt: daysAgo(95), userId: alex.id, type: 'CHECKING', currency: 'EUR', accountNumber: await accountNumber(), nickname: 'Travel EUR' } }),
  ]);
  const [sChk, sSav] = await Promise.all([
    prisma.account.create({ data: { createdAt: daysAgo(75), userId: sam.id, type: 'CHECKING', accountNumber: await accountNumber() } }),
    prisma.account.create({ data: { createdAt: daysAgo(75), userId: sam.id, type: 'SAVINGS', accountNumber: await accountNumber(), interestRate: new Prisma.Decimal('0.02') } }),
  ]);
  const adminChk = await prisma.account.create({ data: { createdAt: daysAgo(35), userId: admin.id, type: 'BUSINESS', accountNumber: await accountNumber() } });

  const debitCard = await prisma.card.create({ data: card(alex.id, aChk.id, 'PHYSICAL', 'VISA', 'Alex Morgan', null) });
  await prisma.card.create({ data: card(alex.id, aChk.id, 'VIRTUAL', 'MASTERCARD', 'Alex Morgan', 'Online shopping') });
  await prisma.card.create({ data: card(sam.id, sChk.id, 'PHYSICAL', 'MASTERCARD', 'Sam Rivera', null) });

  // ---- Alex: salary, rent, bills, card spend, savings transfers, P2P with Sam ----
  const legs: Leg[] = [];
  const savingsLegs: Leg[] = [];
  const samLegs: Leg[] = [];
  for (let m = 3; m >= 0; m--) {
    const payday = daysAgo(m * 30 + 1, 9);
    if (payday <= new Date()) legs.push({ at: payday, direction: 'CREDIT', kind: 'DEPOSIT', amount: 6200, description: 'Salary · Acme Corp', category: 'Income', merchant: 'Acme Corp' });
    const rentDay = daysAgo(m * 30, 10);
    if (m > 0 || rentDay <= new Date()) {
      legs.push({ at: rentDay, direction: 'DEBIT', kind: 'BILL_PAYMENT', amount: 2100, description: 'Rent · Bay Properties', category: 'Housing', merchant: 'Bay Properties' });
      legs.push({ at: daysAgo(Math.max(0, m * 30 - 3), 8), direction: 'DEBIT', kind: 'BILL_PAYMENT', amount: 64.99, description: 'Internet · Sonic', category: 'Utilities', merchant: 'Sonic' });
      legs.push({ at: daysAgo(Math.max(0, m * 30 - 5), 8), direction: 'DEBIT', kind: 'BILL_PAYMENT', amount: 15.99, description: 'Netflix', category: 'Subscriptions', merchant: 'Netflix' });
      const ref = randomUUID();
      const saveAt = daysAgo(Math.max(0, m * 30 - 1), 11);
      legs.push({ at: saveAt, direction: 'DEBIT', kind: 'TRANSFER_OUT', amount: 800, description: 'Transfer to savings', category: 'Transfers', counterparty: aSav.accountNumber, reference: ref });
      savingsLegs.push({ at: saveAt, direction: 'CREDIT', kind: 'TRANSFER_IN', amount: 800, description: 'Transfer to savings', category: 'Transfers', counterparty: aChk.accountNumber, reference: ref });
    }
  }
  savingsLegs.push({ at: daysAgo(95), direction: 'CREDIT', kind: 'DEPOSIT', amount: 9000, description: 'Opening deposit', category: 'Income' });
  for (let d = 88; d >= 0; d--) {
    const count = rnd() < 0.35 ? 0 : rnd() < 0.7 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const s = pick(SPEND);
      legs.push({ at: daysAgo(d, 9 + Math.floor(rnd() * 11)), direction: 'DEBIT', kind: s.kind, amount: Number((s.min + rnd() * (s.max - s.min)).toFixed(2)), description: s.merchant, category: s.category, merchant: s.merchant, cardId: s.kind === 'CARD_PURCHASE' ? debitCard.id : undefined });
    }
  }
  for (const [d, amt, note] of [[40, 45, 'Concert tickets'], [18, 32.5, 'Pizza night'], [6, 60, 'Groceries split']] as const) {
    const ref = randomUUID();
    legs.push({ at: daysAgo(d, 19), direction: 'CREDIT', kind: 'P2P_IN', amount: amt, description: note, category: 'Transfers', counterparty: `Sam R. · ${sChk.accountNumber}`, reference: ref });
    samLegs.push({ at: daysAgo(d, 19), direction: 'DEBIT', kind: 'P2P_OUT', amount: amt, description: note, category: 'Transfers', counterparty: `Alex M. · ${aChk.accountNumber}`, reference: ref });
  }
  // Investment purchases (holdings created below).
  const buys: { symbol: string; name: string; type: AssetType; qty: number; price: number; d: number }[] = [
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCK', qty: 12, price: 214.3, d: 80 },
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', qty: 6, price: 498.1, d: 60 },
    { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', type: 'BOND', qty: 20, price: 72.4, d: 45 },
    { symbol: 'ETH', name: 'Ethereum', type: 'CRYPTO', qty: 0.75, price: 2350, d: 30 },
    { symbol: 'BTC', name: 'Bitcoin', type: 'CRYPTO', qty: 0.02, price: 61000, d: 20 },
  ];
  for (const b of buys) {
    legs.push({ at: daysAgo(b.d, 15), direction: 'DEBIT', kind: 'INVESTMENT_BUY', amount: Number((b.qty * b.price).toFixed(2)), description: `Buy ${b.qty} ${b.symbol} @ ${b.price}`, category: 'Investments', merchant: b.name });
  }
  legs.push({ at: daysAgo(92, 9), direction: 'CREDIT', kind: 'DEPOSIT', amount: 4500, description: 'Opening deposit', category: 'Income' });

  await writeHistory(aChk.id, 'USD', legs);
  await writeHistory(aSav.id, 'USD', savingsLegs);
  await writeHistory(aEur.id, 'EUR', [{ at: daysAgo(50), direction: 'CREDIT', kind: 'DEPOSIT', amount: 750, description: 'Opening deposit', category: 'Income' }]);
  samLegs.push({ at: daysAgo(70), direction: 'CREDIT', kind: 'DEPOSIT', amount: 3200, description: 'Salary · Studio Nine', category: 'Income', merchant: 'Studio Nine' });
  samLegs.push({ at: daysAgo(40), direction: 'CREDIT', kind: 'DEPOSIT', amount: 3200, description: 'Salary · Studio Nine', category: 'Income', merchant: 'Studio Nine' });
  samLegs.push({ at: daysAgo(10), direction: 'CREDIT', kind: 'DEPOSIT', amount: 3200, description: 'Salary · Studio Nine', category: 'Income', merchant: 'Studio Nine' });
  await writeHistory(sChk.id, 'USD', samLegs);
  await writeHistory(sSav.id, 'USD', [{ at: daysAgo(70), direction: 'CREDIT', kind: 'DEPOSIT', amount: 2500, description: 'Opening deposit', category: 'Income' }]);
  await writeHistory(adminChk.id, 'USD', [{ at: daysAgo(30), direction: 'CREDIT', kind: 'DEPOSIT', amount: 1000, description: 'Opening deposit', category: 'Income' }]);

  for (const b of buys) {
    await prisma.holding.create({ data: { userId: alex.id, symbol: b.symbol, name: b.name, assetType: b.type, quantity: new Prisma.Decimal(b.qty), avgPrice: new Prisma.Decimal(b.price) } });
    await prisma.trade.create({ data: { userId: alex.id, accountId: aChk.id, symbol: b.symbol, assetType: b.type, side: 'BUY', quantity: new Prisma.Decimal(b.qty), price: new Prisma.Decimal(b.price), total: D(b.qty * b.price), priceSource: 'seed', createdAt: daysAgo(b.d, 15) } });
  }
  // Portfolio value history for the performance chart (grows from each buy date).
  for (let d = 80; d >= 1; d--) {
    const owned = buys.filter((b) => b.d >= d);
    const invested = owned.reduce((s, b) => s + b.qty * b.price, 0);
    const drift = 1 + Math.sin(d / 9) * 0.03 + (80 - d) * 0.0008;
    const day = new Date(daysAgo(d).toISOString().slice(0, 10));
    await prisma.portfolioSnapshot.create({ data: { userId: alex.id, day, value: D(invested * drift), invested: D(invested) } });
  }

  const today = new Date();
  const inDays = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n, 9);
  await prisma.bill.createMany({
    data: [
      { userId: alex.id, accountId: aChk.id, name: 'Rent', payee: 'Bay Properties', category: 'rent', amount: D(2100), dueDate: inDays(9), recurrence: 'MONTHLY', autoPay: true },
      { userId: alex.id, accountId: aChk.id, name: 'Electricity', payee: 'PG&E', category: 'utilities', amount: D(86.4), dueDate: inDays(2), recurrence: 'MONTHLY' },
      { userId: alex.id, accountId: aChk.id, name: 'Internet', payee: 'Sonic', category: 'internet', amount: D(64.99), dueDate: inDays(14), recurrence: 'MONTHLY', autoPay: true },
      { userId: alex.id, accountId: aChk.id, name: 'Phone', payee: 'Mint Mobile', category: 'phone', amount: D(30), dueDate: inDays(-2), recurrence: 'MONTHLY' },
      { userId: alex.id, accountId: aChk.id, name: 'Car insurance', payee: 'Geico', category: 'insurance', amount: D(412), dueDate: inDays(40), recurrence: 'YEARLY' },
    ],
  });
  await prisma.budgetCategory.createMany({
    data: [
      { userId: alex.id, name: 'Groceries', icon: '🛒', color: '#10b981', limit: D(600) },
      { userId: alex.id, name: 'Food & Dining', icon: '🍽️', color: '#f59e0b', limit: D(350), alertThreshold: 75 },
      { userId: alex.id, name: 'Transport', icon: '🚗', color: '#3b82f6', limit: D(250) },
      { userId: alex.id, name: 'Shopping', icon: '🛍️', color: '#8b5cf6', limit: D(400), rollover: true },
      { userId: alex.id, name: 'Entertainment', icon: '🎬', color: '#ec4899', limit: D(120), period: 'MONTHLY' },
    ],
  });
  await prisma.payee.create({ data: { userId: alex.id, name: 'Sam Rivera', accountNumber: sChk.accountNumber } });
  await prisma.payee.create({ data: { userId: sam.id, name: 'Alex Morgan', accountNumber: aChk.accountNumber } });

  await prisma.splitBill.create({
    data: {
      creatorId: alex.id,
      accountId: aChk.id,
      title: 'Lake Tahoe cabin',
      totalAmount: D(480),
      participants: {
        create: [
          { userId: alex.id, name: 'Alex Morgan', email: alex.email, amount: D(160), paid: true, paidAt: new Date() },
          { userId: sam.id, name: 'Sam Rivera', email: sam.email, amount: D(160) },
          { name: 'Jordan Lee', email: 'jordan@example.com', amount: D(160) },
        ],
      },
    },
  });
  await prisma.scheduledPayment.create({
    data: { userId: alex.id, kind: 'TRANSFER', fromAccountId: aChk.id, toAccountNumber: aSav.accountNumber, amount: D(250), description: 'Weekly savings sweep', frequency: 'WEEKLY', nextRunAt: inDays(3) },
  });
  await prisma.notification.createMany({
    data: [
      { userId: alex.id, type: 'bill', title: 'Phone is overdue', body: '30.00 due ' + inDays(-2).toISOString().slice(0, 10) },
      { userId: alex.id, type: 'split', title: 'Sam R. joined "Lake Tahoe cabin"', body: 'Waiting for 2 shares' },
      { userId: alex.id, type: 'security', title: 'Welcome to PocketBank', body: 'Turn on biometric unlock and 2FA in Profile → Security.', read: true },
    ],
  });
  console.log('Seeded demo users: alex@pocketbank.dev, sam@pocketbank.dev, admin@pocketbank.dev (password Password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
