/**
 * Rate Limiting Service (HLD/LLD) — client side. The same token-bucket algorithm the API enforces
 * with Redis, used on the device to throttle money-moving taps before they ever hit the network.
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export interface BucketOptions {
  capacity: number;
  refillPerSecond: number;
}

export class RateLimitingService {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(private readonly options: BucketOptions = { capacity: 100, refillPerSecond: 1 }) {}

  async isAllowed(key: string, tokensRequested = 1): Promise<boolean> {
    const bucket = this.refill(key);
    if (bucket.tokens < tokensRequested) return false;
    bucket.tokens -= tokensRequested;
    return true;
  }

  async getRemainingTokens(key: string): Promise<number> {
    return Math.floor(this.refill(key).tokens);
  }

  async resetBucket(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  private refill(key: string): TokenBucket {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.options.capacity, lastRefill: now };
    bucket.tokens = Math.min(this.options.capacity, bucket.tokens + ((now - bucket.lastRefill) / 1000) * this.options.refillPerSecond);
    bucket.lastRefill = now;
    this.buckets.set(key, bucket);
    return bucket;
  }
}
