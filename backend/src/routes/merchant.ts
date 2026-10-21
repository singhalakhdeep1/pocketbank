/**
 * Merchant / card-network side, protected by MERCHANT_API_KEY. It lets a point-of-sale or a test
 * script charge PocketBank cards (enforcing status, channel toggles and spending limits) and issue
 * signed merchant QR codes.
 */
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { ApiError, unauthorized } from '../lib/errors.js';
import { logger, prisma } from '../lib/infra.js';
import * as serialize from '../lib/serialize.js';
import { decrypt, lookupHash, safeEqual } from '../lib/security.js';
import { body, money } from '../middleware/validate.js';
import { cardSpend } from '../services/card.service.js';
import { external } from '../services/ledger.service.js';
import { notify } from '../services/notification.service.js';
import { merchantPayload } from './payments.js';

export const merchantRouter = Router();

merchantRouter.use((req, _res, next) => {
  const key = req.header('x-api-key') ?? '';
  if (!config.merchantApiKey || !safeEqual(key, config.merchantApiKey)) return next(unauthorized('Invalid merchant API key'));
  next();
});

merchantRouter.post('/qr', (req, res) => {
  const input = body(
    req,
    z.object({
      merchantId: z.string().trim().min(2).max(40),
      name: z.string().trim().min(1).max(60),
      category: z.string().trim().max(40).default('Shopping'),
      amount: z.number().positive().optional(),
      currency: z.string().length(3).toUpperCase().default('USD'),
    }),
  );
  res.status(201).json({ payload: merchantPayload({ mid: input.merchantId, name: input.name, cat: input.category, amount: input.amount, cur: input.currency }) });
});

const decline = (code: string, message: string) => new ApiError(402, code, message);

merchantRouter.post('/charges', async (req, res) => {
  const input = body(
    req,
    z.object({
      cardNumber: z.string().transform((v) => v.replace(/\s/g, '')),
      expiry: z.string().regex(/^\d{2}\/\d{2}$/),
      cvv: z.string().regex(/^\d{3,4}$/).optional(),
      amount: money,
      merchant: z.string().trim().min(1).max(60),
      category: z.string().trim().max(40).default('Shopping'),
      channel: z.enum(['online', 'contactless', 'chip']).default('online'),
    }),
  );
  const card = await prisma.card.findUnique({ where: { panHash: lookupHash(input.cardNumber) } });
  const reject = async (code: string, message: string) => {
    if (card) {
      logger.logAuditEvent('CardDeclined', `Card declined: ${code}`, { userId: card.userId, cardId: card.id, merchant: input.merchant, amount: input.amount });
      void notify(card.userId, 'security', 'Card payment declined', `${input.merchant} · ${input.amount.toFixed(2)} · ${message}`, { cardId: card.id });
    }
    throw decline(code, message);
  };
  if (!card) throw decline('CARD_UNKNOWN', 'Card not recognised');
  const [mm, yy] = input.expiry.split('/').map(Number);
  if (mm !== card.expiryMonth || 2000 + yy !== card.expiryYear) return reject('BAD_EXPIRY', 'Expiry date does not match');
  if (new Date(card.expiryYear, card.expiryMonth, 1) < new Date()) return reject('CARD_EXPIRED', 'Card has expired');
  if (input.channel === 'online' && (!input.cvv || !safeEqual(decrypt(card.cvvEncrypted), input.cvv))) return reject('BAD_CVV', 'Security code is incorrect');
  if (card.status !== 'ACTIVE') return reject('CARD_NOT_ACTIVE', `Card is ${card.status.toLowerCase()}`);
  if (input.channel === 'online' && !card.onlineEnabled) return reject('ONLINE_DISABLED', 'Online payments are turned off for this card');
  if (input.channel === 'contactless' && !card.contactlessEnabled) return reject('CONTACTLESS_DISABLED', 'Contactless payments are turned off for this card');
  const spend = await cardSpend(card.id);
  if (spend.today + input.amount > Number(card.dailyLimit)) return reject('DAILY_LIMIT', 'Daily card limit reached');
  if (spend.thisMonth + input.amount > Number(card.monthlyLimit)) return reject('MONTHLY_LIMIT', 'Monthly card limit reached');

  const account = await prisma.account.findUniqueOrThrow({ where: { id: card.accountId } });
  try {
    const leg = await external(account, 'DEBIT', input.amount, {
      kind: 'CARD_PURCHASE',
      description: `${input.merchant}`,
      merchant: input.merchant,
      category: input.category,
      cardId: card.id,
      counterparty: `card •••• ${card.last4}`,
    });
    res.status(201).json({ approved: true, authorizationCode: leg.reference.slice(0, 8).toUpperCase(), transaction: serialize.transaction(leg) });
  } catch (err) {
    if (err instanceof ApiError && err.code === 'INSUFFICIENT_FUNDS') return reject('INSUFFICIENT_FUNDS', 'Insufficient funds');
    throw err;
  }
});
