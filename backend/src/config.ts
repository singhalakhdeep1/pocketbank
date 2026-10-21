import 'dotenv/config';

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== '' && value !== undefined ? parsed : fallback;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';

function secret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (nodeEnv === 'production') throw new Error(`${name} must be set in production`);
  return devFallback;
}

export const config = {
  nodeEnv,
  port: num(process.env.PORT, 4001),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/pocketbank',
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),

  jwtSecret: secret('JWT_SECRET', 'dev-only-jwt-secret-change-me'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenDays: num(process.env.REFRESH_TOKEN_DAYS, 30),
  // 32-byte key (hex or any string, hashed to 32 bytes) used to encrypt card numbers and 2FA secrets
  dataKey: secret('DATA_ENCRYPTION_KEY', 'dev-only-data-key-change-me'),

  redisUrl: process.env.REDIS_URL ?? (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT ?? 6379}` : ''),
  cacheTtlSeconds: num(process.env.CACHE_TTL_SECONDS, 3600),
  rateLimit: {
    capacity: num(process.env.RATE_LIMIT_BUCKET_CAPACITY, 100),
    refillPerSecond: num(process.env.RATE_LIMIT_REFILL_RATE, 1),
    authCapacity: num(process.env.RATE_LIMIT_AUTH_CAPACITY, 10),
    authRefillPerSecond: num(process.env.RATE_LIMIT_AUTH_REFILL_RATE, 0.1),
  },

  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeApiBase: process.env.STRIPE_API_BASE ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',

  alphaVantageKey: process.env.ALPHA_VANTAGE_KEY ?? '',
  coinbaseApi: process.env.COINBASE_API_URL ?? 'https://api.coinbase.com',
  fxApi: process.env.FX_API_URL ?? 'https://api.frankfurter.dev/v1',
  ethereumRpcUrl: process.env.ETHEREUM_RPC_URL ?? '',

  expoPushUrl: process.env.EXPO_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send',
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN ?? '',
  smtpUrl: process.env.SMTP_URL ?? '',
  mailFrom: process.env.MAIL_FROM ?? 'PocketBank <no-reply@pocketbank.local>',

  merchantApiKey: process.env.MERCHANT_API_KEY ?? '',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  schedulerIntervalMs: num(process.env.SCHEDULER_INTERVAL_MS, 60_000),
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== 'false',
  savingsApy: num(process.env.SAVINGS_APY, 0.02),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
