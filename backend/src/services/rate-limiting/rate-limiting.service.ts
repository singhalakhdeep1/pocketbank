/**
 * Rate Limiting Service for PocketBank (HLD/LLD: API Rate Limiting)
 * Token bucket per key. With Redis the refill + take runs in one Lua script, so concurrent API
 * instances share a bucket without races; without Redis an in-process map is used.
 */
import { Redis } from 'ioredis';

export interface BucketOptions {
  capacity: number;
  refillPerSecond: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

// KEYS[1] bucket key; ARGV: capacity, refill/sec, requested, now(ms)
const TAKE_SCRIPT = `
local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then tokens = capacity; ts = now end
tokens = math.min(capacity, tokens + ((now - ts) / 1000) * rate)
local allowed = 0
if tokens >= requested then tokens = tokens - requested; allowed = 1 end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))
redis.call('PEXPIRE', KEYS[1], math.ceil((capacity / rate) * 1000) + 1000)
return { allowed, tostring(tokens) }
`;

export class RateLimitingService {
  private readonly memory = new Map<string, TokenBucket>();

  constructor(
    private readonly redis: Redis | null,
    private readonly defaults: BucketOptions = { capacity: 100, refillPerSecond: 1 },
  ) {}

  async isAllowed(key: string, tokensRequested = 1, options: BucketOptions = this.defaults): Promise<boolean> {
    return (await this.take(key, tokensRequested, options)).allowed;
  }

  async take(key: string, tokensRequested = 1, options: BucketOptions = this.defaults): Promise<RateLimitResult> {
    const { capacity, refillPerSecond } = options;
    let allowed: boolean;
    let tokens: number;
    if (this.redis) {
      const [ok, left] = (await this.redis.eval(
        TAKE_SCRIPT,
        1,
        `pb:rate_limit:${key}`,
        capacity,
        refillPerSecond,
        tokensRequested,
        Date.now(),
      )) as [number, string];
      allowed = ok === 1;
      tokens = Number(left);
    } else {
      const bucket = this.refill(key, options);
      allowed = bucket.tokens >= tokensRequested;
      if (allowed) bucket.tokens -= tokensRequested;
      tokens = bucket.tokens;
    }
    const deficit = Math.max(0, tokensRequested - tokens);
    return {
      allowed,
      remaining: Math.floor(tokens),
      retryAfterSeconds: allowed ? 0 : Math.ceil(deficit / refillPerSecond),
      limit: capacity,
    };
  }

  async getRemainingTokens(key: string, options: BucketOptions = this.defaults): Promise<number> {
    if (this.redis) {
      const [tokens, ts] = await this.redis.hmget(`pb:rate_limit:${key}`, 'tokens', 'ts');
      if (tokens === null || ts === null) return options.capacity;
      const refilled = Number(tokens) + ((Date.now() - Number(ts)) / 1000) * options.refillPerSecond;
      return Math.floor(Math.min(options.capacity, refilled));
    }
    return Math.floor(this.refill(key, options).tokens);
  }

  async resetBucket(key: string): Promise<void> {
    if (this.redis) await this.redis.del(`pb:rate_limit:${key}`);
    else this.memory.delete(key);
  }

  private refill(key: string, { capacity, refillPerSecond }: BucketOptions): TokenBucket {
    const now = Date.now();
    const bucket = this.memory.get(key) ?? { tokens: capacity, lastRefill: now };
    bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.lastRefill) / 1000) * refillPerSecond);
    bucket.lastRefill = now;
    this.memory.set(key, bucket);
    return bucket;
  }
}
