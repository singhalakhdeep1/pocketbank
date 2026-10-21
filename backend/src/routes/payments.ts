import { createHmac } from 'node:crypto';
import express, { Router, type Request } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { badRequest, notFound, unprocessable } from '../lib/errors.js';
import { logger, prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { safeEqual } from '../lib/security.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { idempotent } from '../middleware/idempotency.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { body, money } from '../middleware/validate.js';
import { external } from '../services/ledger.service.js';
import { notify } from '../services/notification.service.js';
import { stripe, stripeEnabled } from '../services/payment-gateway.service.js';
import { defaultAccount, maskName, ownedAccount } from './helpers.js';
import { sendMoney } from './transfers.js';

export const paymentsRouter = Router();

// ---------------- QR codes ----------------
// Personal QR:  pocketbank://pay?acct=<number>&name=<display>&amount=<optional>&cur=USD&note=<optional>
// Merchant QR:  pocketbank://merchant?mid=..&name=..&cat=..&amount=..&cur=USD&sig=<hmac>  (issued by /merchant/qr)

const MERCHANT_FIELDS = ['mid', 'name', 'cat', 'amount', 'cur'] as const;

export function signMerchant(params: Record<string, string>): string {
  const canonical = MERCHANT_FIELDS.map((k) => `${k}=${params[k] ?? ''}`).join('&');
  return createHmac('sha256', config.dataKey).update(`merchant-qr:${canonical}`).digest('hex').slice(0, 32);
}

export function merchantPayload(input: { mid: string; name: string; cat: string; amount?: number; cur: string }) {
  const params: Record<string, string> = {
    mid: input.mid,
    name: input.name,
    cat: input.cat,
    amount: input.amount ? input.amount.toFixed(2) : '',
    cur: input.cur,
  };
  const qs = new URLSearchParams({ ...params, sig: signMerchant(params) });
  return `pocketbank://merchant?${qs.toString()}`;
}

type ParsedQr =
  | { kind: 'person'; accountNumber: string; name: string; amount: number | null; currency: string; note: string | null }
  | { kind: 'merchant'; merchantId: string; name: string; category: string; amount: number | null; currency: string };

export function parseQr(payload: string): ParsedQr {
  let url: URL;
  try {
    url = new URL(payload.trim());
  } catch {
    throw badRequest('Not a PocketBank QR code');
  }
  if (url.protocol !== 'pocketbank:') throw badRequest('Not a PocketBank QR code');
  const p = Object.fromEntries(url.searchParams.entries());
  const amount = p.amount ? Number(p.amount) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) throw badRequest('QR code has an invalid amount');
  if (url.host === 'pay' && p.acct) {
    return { kind: 'person', accountNumber: p.acct, name: p.name ?? 'PocketBank customer', amount, currency: p.cur ?? 'USD', note: p.note ?? null };
  }
  if (url.host === 'merchant' && p.mid && p.sig) {
    if (!safeEqual(signMerchant(p), p.sig)) throw unprocessable('QR_TAMPERED', 'Merchant QR code signature is invalid');
    return { kind: 'merchant', merchantId: p.mid, name: p.name ?? p.mid, category: p.cat || 'Shopping', amount, currency: p.cur ?? 'USD' };
  }
  throw badRequest('Unrecognised QR code');
}

paymentsRouter.get('/payments/qr/receive', requireAuth, async (req, res) => {
  const q = z.object({ accountId: z.string().uuid().optional(), amount: z.coerce.number().positive().optional(), note: z.string().max(60).optional() }).parse(req.query);
  const uid = userId(req);
  const account = await defaultAccount(uid, q.accountId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  const qs = new URLSearchParams({ acct: account.accountNumber, name: maskName(user.firstName, user.lastName), cur: account.currency });
  if (q.amount) qs.set('amount', q.amount.toFixed(2));
  if (q.note) qs.set('note', q.note);
  res.json({ payload: `pocketbank://pay?${qs.toString()}`, accountNumber: account.accountNumber, currency: account.currency });
});

paymentsRouter.post('/payments/qr/parse', requireAuth, (req, res) => {
  const { payload } = body(req, z.object({ payload: z.string().min(10).max(1000) }));
  res.json(parseQr(payload));
});

paymentsRouter.post('/payments/qr/pay', requireAuth, rateLimit('transfer', { capacity: 20, refillPerSecond: 0.2 }), idempotent, async (req, res) => {
  const input = body(req, z.object({ payload: z.string().min(10).max(1000), fromAccountId: z.string().uuid().optional(), amount: money.optional(), note: z.string().max(140).optional() }));
  const uid = userId(req);
  const qr = parseQr(input.payload);
  const amount = qr.amount ?? input.amount;
  if (!amount) throw badRequest('Enter an amount');
  if (qr.amount && input.amount && Math.abs(qr.amount - input.amount) > 0.001) throw unprocessable('AMOUNT_MISMATCH', 'This QR code is for a fixed amount');
  const from = await defaultAccount(uid, input.fromAccountId);

  if (qr.kind === 'person') {
    const to = await prisma.account.findUnique({ where: { accountNumber: qr.accountNumber }, include: { user: true } });
    if (!to) throw notFound('Recipient account');
    const { result } = await sendMoney(uid, from, to, amount, input.note ?? qr.note, qr.note ?? 'QR payment');
    return res.status(201).json({ kind: 'person', reference: result.reference, transactionId: result.debit.id, status: 'SUCCESS', amount, recipient: qr.name });
  }

  const leg = await external(from, 'DEBIT', amount, {
    kind: 'QR_PAYMENT',
    description: `QR payment · ${qr.name}`,
    merchant: qr.name,
    category: qr.category,
    counterparty: qr.merchantId,
    notes: input.note,
  });
  res.status(201).json({ kind: 'merchant', reference: leg.reference, transactionId: leg.id, status: 'SUCCESS', merchantId: qr.merchantId, amount });
});

// ---------------- card top-ups through Stripe ----------------

async function creditTopUp(paymentIntentId: string, amountMinor: number, currency: string, accountId: string, uid: string) {
  // The IdempotencyKey row acts as a once-only latch, so the webhook and the confirm call cannot both credit.
  try {
    await prisma.idempotencyKey.create({
      data: { key: `stripe:${paymentIntentId}`, userId: uid, method: 'STRIPE', path: paymentIntentId, statusCode: 200, response: {} },
    });
  } catch {
    return null;
  }
  const account = await ownedAccount(uid, accountId);
  if (account.currency.toLowerCase() !== currency.toLowerCase()) throw unprocessable('CURRENCY_MISMATCH', 'Top-up currency differs from account');
  const leg = await external(account, 'CREDIT', amountMinor / 100, {
    kind: 'TOPUP',
    description: 'Card top-up',
    category: 'Income',
    reference: paymentIntentId,
    merchant: 'Stripe',
  });
  logger.logAuditEvent('TopUpCredited', 'Card top-up credited', { userId: uid, accountId, paymentIntentId });
  return leg;
}

paymentsRouter.post('/payments/topup/intent', requireAuth, idempotent, async (req, res) => {
  const input = body(req, z.object({ accountId: z.string().uuid(), amount: money.refine((v) => v >= 1 && v <= 5000, 'Top-ups are between 1 and 5,000') }));
  const uid = userId(req);
  const account = await ownedAccount(uid, input.accountId);
  const intent = await stripe().paymentIntents.create({
    amount: Math.round(input.amount * 100),
    currency: account.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: { userId: uid, accountId: account.id, purpose: 'pocketbank_topup' },
  });
  res.status(201).json({ paymentIntentId: intent.id, clientSecret: intent.client_secret, amount: input.amount, currency: account.currency, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null });
});

paymentsRouter.post('/payments/topup/confirm', requireAuth, async (req, res) => {
  const { paymentIntentId } = body(req, z.object({ paymentIntentId: z.string().startsWith('pi_') }));
  const uid = userId(req);
  const intent = await stripe().paymentIntents.retrieve(paymentIntentId);
  if (intent.metadata?.userId !== uid) throw notFound('Payment');
  if (intent.status !== 'succeeded') return res.status(202).json({ status: intent.status, credited: false });
  const leg = await creditTopUp(intent.id, intent.amount_received || intent.amount, intent.currency, String(intent.metadata.accountId), uid);
  res.json({ status: intent.status, credited: true, transaction: leg ? serialize.transaction(leg) : null });
});

/** Mounted before the JSON body parser: Stripe signs the raw body. */
export const stripeWebhook = [
  express.raw({ type: 'application/json' }),
  async (req: Request, res: express.Response) => {
    if (!stripeEnabled() || !config.stripeWebhookSecret) return res.status(503).json({ error: 'Stripe webhooks not configured' });
    let event;
    try {
      event = stripe().webhooks.constructEvent(req.body as Buffer, req.header('stripe-signature') ?? '', config.stripeWebhookSecret);
    } catch (err) {
      logger.logWarning('Rejected Stripe webhook', { error: String(err) });
      return res.status(400).json({ error: 'Invalid signature' });
    }
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      if (intent.metadata?.purpose === 'pocketbank_topup' && intent.metadata.userId && intent.metadata.accountId) {
        const leg = await creditTopUp(intent.id, intent.amount_received || intent.amount, intent.currency, intent.metadata.accountId, intent.metadata.userId);
        if (leg) void notify(intent.metadata.userId, 'transaction', 'Top-up complete', `${(intent.amount / 100).toFixed(2)} ${intent.currency.toUpperCase()} added to your account`);
      }
    }
    res.json({ received: true });
  },
];
