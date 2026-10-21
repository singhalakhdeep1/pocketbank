import { Redis } from 'ioredis';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { config } from '../config.js';
import { CacheService } from '../services/cache/cache.service.js';
import { RateLimitingService } from '../services/rate-limiting/rate-limiting.service.js';
import { StructuredLoggingService } from '../services/structured-logging/structured-logging.service.js';

export const logger = new StructuredLoggingService('pocketbank-api', config.logLevel);

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });

export const redis: Redis | null = config.redisUrl
  ? new Redis(config.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false })
  : null;
redis?.on('error', (err) => logger.logError('Redis connection error', err));

export const cache = new CacheService(redis, config.cacheTtlSeconds);
export const rateLimiter = new RateLimitingService(redis, {
  capacity: config.rateLimit.capacity,
  refillPerSecond: config.rateLimit.refillPerSecond,
});

// Audit events from the logging service are also stored in the AuditLog table.
logger.setAuditSink(async ({ eventType, description, context, metadata }) => {
  await prisma.auditLog.create({
    data: {
      eventType,
      description,
      userId: context.userId ?? (typeof metadata?.userId === 'string' ? metadata.userId : null),
      correlationId: context.correlationId,
      ip: context.ip ?? null,
      metadata: (metadata ?? {}) as object,
    },
  });
});
