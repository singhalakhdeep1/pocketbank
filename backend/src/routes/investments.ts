import { Router } from 'express';
import { z } from 'zod';
import { notFound, unavailable, unprocessable } from '../lib/errors.js';
import { prisma } from '../lib/infra.js';
import { dec, num, qty, toMoney } from '../lib/money.js';
import { userId } from '../middleware/auth.js';
import { idempotent } from '../middleware/idempotency.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { body } from '../middleware/validate.js';
import { external } from '../services/ledger.service.js';
import { assertTradable, history, instrument, quote, quotes, search } from '../services/market-data.service.js';
import { notify } from '../services/notification.service.js';
import { defaultAccount, param } from './helpers.js';

export const investmentsRouter = Router();

export async function portfolio(uid: string) {
  const holdings = await prisma.holding.findMany({ where: { userId: uid }, orderBy: { createdAt: 'asc' } });
  const q = holdings.length ? await quotes(holdings.map((h) => h.symbol)) : [];
  const rows = holdings.map((h, i) => {
    const quantity = qty(h.quantity);
    const avgPrice = Number(h.avgPrice);
    const value = quantity * q[i].price;
    const invested = quantity * avgPrice;
    return {
      id: h.id,
      symbol: h.symbol,
      name: h.name,
      assetType: h.assetType,
      quantity,
      avgPrice,
      currentPrice: q[i].price,
      value: Number(value.toFixed(2)),
      invested: Number(invested.toFixed(2)),
      gain: Number((value - invested).toFixed(2)),
      gainPercent: invested ? Number((((value - invested) / invested) * 100).toFixed(2)) : 0,
      dayChange: Number((quantity * q[i].change).toFixed(2)),
      dayChangePercent: q[i].changePercent,
      priceSource: q[i].source,
    };
  });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalInvested = rows.reduce((s, r) => s + r.invested, 0);
  const allocation = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.assetType]: (acc[r.assetType] ?? 0) + r.value }), {}),
  ).map(([type, value]) => ({ type, value: Number(value.toFixed(2)), percentage: totalValue ? Number(((value / totalValue) * 100).toFixed(1)) : 0 }));
  return {
    holdings: rows,
    totals: {
      value: Number(totalValue.toFixed(2)),
      invested: Number(totalInvested.toFixed(2)),
      gain: Number((totalValue - totalInvested).toFixed(2)),
      gainPercent: totalInvested ? Number((((totalValue - totalInvested) / totalInvested) * 100).toFixed(2)) : 0,
      dayChange: Number(rows.reduce((s, r) => s + r.dayChange, 0).toFixed(2)),
    },
    allocation,
  };
}

/** Upserts today's portfolio value so the performance chart has one point per day. */
export async function snapshot(uid: string) {
  const p = await portfolio(uid);
  const day = new Date(new Date().toISOString().slice(0, 10));
  await prisma.portfolioSnapshot.upsert({
    where: { userId_day: { userId: uid, day } },
    update: { value: p.totals.value, invested: p.totals.invested },
    create: { userId: uid, day, value: p.totals.value, invested: p.totals.invested },
  });
  return p;
}

investmentsRouter.get('/investments/portfolio', async (req, res) => {
  const uid = userId(req);
  const p = await portfolio(uid);
  const snapshots = await prisma.portfolioSnapshot.findMany({ where: { userId: uid }, orderBy: { day: 'asc' }, take: 365 });
  res.json({
    ...p,
    performance: snapshots.map((s) => ({ date: s.day.toISOString().slice(0, 10), value: num(s.value), invested: num(s.invested) })),
  });
});

investmentsRouter.get('/investments/instruments', (req, res) => {
  const { q, type } = z.object({ q: z.string().default(''), type: z.enum(['STOCK', 'ETF', 'MUTUAL_FUND', 'BOND', 'CRYPTO']).optional() }).parse(req.query);
  res.json(search(q).filter((i) => !type || i.assetType === type).map(({ basePrice: _b, ...i }) => i));
});

investmentsRouter.get('/investments/quotes', async (req, res) => {
  const { symbols } = z.object({ symbols: z.string().min(1) }).parse(req.query);
  res.json(await quotes(symbols.split(',').slice(0, 25)));
});

investmentsRouter.get('/investments/quotes/:symbol', async (req, res) => {
  res.json(await quote(param(req.params.symbol)));
});

investmentsRouter.get('/investments/quotes/:symbol/history', async (req, res) => {
  const { days } = z.object({ days: z.coerce.number().int().min(2).max(365).default(30) }).parse(req.query);
  res.json(await history(param(req.params.symbol), days));
});

investmentsRouter.get('/investments/trades', async (req, res) => {
  const trades = await prisma.trade.findMany({ where: { userId: userId(req) }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(
    trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      assetType: t.assetType,
      side: t.side,
      quantity: qty(t.quantity),
      price: Number(t.price),
      total: num(t.total),
      realizedGain: num(t.realizedGain),
      priceSource: t.priceSource,
      createdAt: t.createdAt,
    })),
  );
});

investmentsRouter.post('/investments/trades', rateLimit('trade', { capacity: 30, refillPerSecond: 0.5 }), idempotent, async (req, res) => {
  const input = body(
    req,
    z
      .object({
        symbol: z.string().trim().toUpperCase(),
        side: z.enum(['BUY', 'SELL']),
        quantity: z.coerce.number().positive().optional(),
        amount: z.coerce.number().positive().optional(),
        accountId: z.string().uuid().optional(),
      })
      .refine((v) => Boolean(v.quantity) !== Boolean(v.amount), 'Give either quantity or amount'),
  );
  const uid = userId(req);
  const inst = instrument(input.symbol);
  const q = await quote(inst.symbol);
  assertTradable(q.price);
  if (inst.assetType === 'CRYPTO' && q.source === 'simulated') throw unavailable('Live crypto prices are unreachable right now; try again shortly');
  const account = await defaultAccount(uid, input.accountId);
  if (account.currency !== 'USD') throw unprocessable('CURRENCY', 'Investments settle in USD; pick a USD account');

  const fractional = inst.assetType === 'CRYPTO' || inst.assetType === 'MUTUAL_FUND';
  const decimals = fractional ? 8 : 4;
  const quantity = dec(input.quantity ?? (input.amount as number) / q.price).toDecimalPlaces(decimals, 1);
  if (quantity.lte(0)) throw unprocessable('QUANTITY_TOO_SMALL', 'Amount is too small for one unit');
  const total = toMoney(quantity.mul(q.price));
  if (total.lt(1)) throw unprocessable('MIN_ORDER', 'Minimum order is 1.00');
  const holding = await prisma.holding.findUnique({ where: { userId_symbol: { userId: uid, symbol: inst.symbol } } });

  let realizedGain = dec(0);
  if (input.side === 'SELL') {
    if (!holding || holding.quantity.lt(quantity)) throw unprocessable('INSUFFICIENT_HOLDINGS', 'You do not own that many units');
    realizedGain = toMoney(dec(q.price).minus(holding.avgPrice).mul(quantity));
  }

  const leg = await external(
    account,
    input.side === 'BUY' ? 'DEBIT' : 'CREDIT',
    total,
    {
      kind: input.side === 'BUY' ? 'INVESTMENT_BUY' : 'INVESTMENT_SELL',
      description: `${input.side === 'BUY' ? 'Buy' : 'Sell'} ${quantity.toString()} ${inst.symbol} @ ${q.price}`,
      category: 'Investments',
      merchant: inst.name,
    },
    async (tx) => {
      if (input.side === 'BUY') {
        if (holding) {
          const newQty = holding.quantity.plus(quantity);
          const avg = holding.avgPrice.mul(holding.quantity).plus(total).div(newQty);
          await tx.holding.update({ where: { id: holding.id }, data: { quantity: newQty, avgPrice: avg.toDecimalPlaces(6) } });
        } else {
          await tx.holding.create({ data: { userId: uid, symbol: inst.symbol, name: inst.name, assetType: inst.assetType, quantity, avgPrice: q.price } });
        }
      } else if (holding) {
        const left = holding.quantity.minus(quantity);
        if (left.lte(0)) await tx.holding.delete({ where: { id: holding.id } });
        else await tx.holding.update({ where: { id: holding.id }, data: { quantity: left } });
      }
      await tx.trade.create({
        data: { userId: uid, accountId: account.id, symbol: inst.symbol, assetType: inst.assetType, side: input.side, quantity, price: q.price, total, realizedGain, priceSource: q.source },
      });
    },
  );
  await snapshot(uid);
  void notify(uid, 'investment', `${input.side === 'BUY' ? 'Bought' : 'Sold'} ${inst.symbol}`, `${quantity.toString()} @ ${q.price} = ${total.toFixed(2)} USD`);
  res.status(201).json({
    symbol: inst.symbol,
    side: input.side,
    quantity: qty(quantity),
    price: q.price,
    total: num(total),
    realizedGain: num(realizedGain),
    priceSource: q.source,
    transactionId: leg.id,
  });
});

investmentsRouter.get('/investments/holdings/:symbol', async (req, res) => {
  const p = await portfolio(userId(req));
  const holding = p.holdings.find((h) => h.symbol === param(req.params.symbol).toUpperCase());
  if (!holding) throw notFound('Holding');
  res.json(holding);
});
