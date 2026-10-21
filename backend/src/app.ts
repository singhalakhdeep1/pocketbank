import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { cache, prisma, redis } from './lib/infra.js';
import { registry } from './metrics.js';
import { requireAdmin, requireAuth } from './middleware/auth.js';
import { requestContext } from './middleware/context.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { rateLimit } from './middleware/rateLimit.js';
import { accountsRouter } from './routes/accounts.js';
import { analyticsRouter } from './routes/analytics.js';
import { atmsRouter } from './routes/atms.js';
import { authRouter } from './routes/auth.js';
import { billsRouter } from './routes/bills.js';
import { budgetsRouter } from './routes/budgets.js';
import { cardsRouter } from './routes/cards.js';
import { cryptoRouter } from './routes/crypto.js';
import { investmentsRouter } from './routes/investments.js';
import { merchantRouter } from './routes/merchant.js';
import { paymentsRouter, stripeWebhook } from './routes/payments.js';
import { profileRouter } from './routes/profile.js';
import { reportsRouter } from './routes/reports.js';
import { splitBillsRouter } from './routes/splitBills.js';
import { transactionsRouter } from './routes/transactions.js';
import { transfersRouter } from './routes/transfers.js';
import { getRates, SUPPORTED_CURRENCIES } from './services/fx.service.js';
import { stripeEnabled } from './services/payment-gateway.service.js';
import { mailEnabled } from './services/mail.service.js';
import { runAutopay, runBillReminders, runInterest, runScheduledPayments, runSnapshots } from './services/scheduler.service.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback');
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      exposedHeaders: ['x-correlation-id', 'RateLimit-Remaining', 'Retry-After', 'content-disposition'],
    }),
  );
  app.use(requestContext);

  app.get('/health', async (_req, res) => {
    const checks: Record<string, string> = {};
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'down';
    }
    if (redis) checks.redis = (await redis.ping().catch(() => 'down')) === 'PONG' ? 'ok' : 'down';
    else checks.redis = 'not configured (in-memory cache)';
    const healthy = checks.database === 'ok' && checks.redis !== 'down';
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', app: 'PocketBank API', checks, cache: { backend: cache.backend, hits: cache.hits, misses: cache.misses } });
  });

  app.get('/metrics', async (_req, res) => {
    res.setHeader('content-type', registry.contentType);
    res.send(await registry.metrics());
  });

  // Stripe needs the raw body, so its webhook is registered before express.json().
  app.post('/api/payments/stripe/webhook', ...stripeWebhook);

  app.use(express.json({ limit: '1mb' }));

  const api = Router();
  api.get('/meta', async (_req, res) => {
    const fx = await getRates();
    res.json({
      version: process.env.npm_package_version ?? '1.0.0',
      features: {
        cardTopUps: stripeEnabled(),
        onChainCrypto: Boolean(config.ethereumRpcUrl),
        liveStockQuotes: Boolean(config.alphaVantageKey),
        email: mailEnabled(),
        sandboxDeposits: process.env.SANDBOX_DEPOSITS !== 'false' && (config.nodeEnv !== 'production' || process.env.SANDBOX_DEPOSITS === 'true'),
      },
      currencies: SUPPORTED_CURRENCIES,
      fx: { source: fx.source, asOf: fx.asOf },
    });
  });
  api.get('/fx/rates', async (_req, res) => {
    res.json(await getRates());
  });
  api.use('/auth', authRouter);
  api.use('/merchant', rateLimit('merchant', { capacity: 200, refillPerSecond: 20 }), merchantRouter);

  // Everything below needs a signed-in customer.
  const secured = Router();
  secured.use(requireAuth, rateLimit('api'));
  secured.use(profileRouter);
  secured.use(accountsRouter);
  secured.use(transactionsRouter);
  secured.use(transfersRouter);
  secured.use(paymentsRouter);
  secured.use(cardsRouter);
  secured.use(billsRouter);
  secured.use(budgetsRouter);
  secured.use(analyticsRouter);
  secured.use(investmentsRouter);
  secured.use(cryptoRouter);
  secured.use(reportsRouter);
  secured.use(splitBillsRouter);
  secured.use(atmsRouter);

  secured.post('/admin/scheduler/run', requireAdmin, async (_req, res) => {
    res.json({
      scheduledPayments: await runScheduledPayments(),
      autopay: await runAutopay(),
      billReminders: await runBillReminders(),
      interest: await runInterest(),
      snapshots: await runSnapshots(),
    });
  });

  api.use(secured);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
