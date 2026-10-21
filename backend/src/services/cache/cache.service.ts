/**
 * Cache Service for PocketBank (HLD/LLD: Distributed Caching)
 * Redis-backed when REDIS_URL / REDIS_HOST is set, with an in-process TTL map as the fallback so the
 * API also runs without Redis (single instance only). Keys are namespaced with `pb:`.
 */
import { Redis } from 'ioredis';

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

const PREFIX = 'pb:';

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export class CacheService {
  private readonly memory = new Map<string, MemoryEntry>();
  hits = 0;
  misses = 0;

  constructor(
    private readonly redis: Redis | null,
    private readonly defaultTTL = 3600,
  ) {}

  get backend(): 'redis' | 'memory' {
    return this.redis ? 'redis' : 'memory';
  }

  async get(key: string): Promise<string | null> {
    let value: string | null;
    if (this.redis) {
      value = await this.redis.get(PREFIX + key);
    } else {
      const entry = this.memory.get(key);
      if (entry && entry.expiresAt <= Date.now()) this.memory.delete(key);
      value = entry && entry.expiresAt > Date.now() ? entry.value : null;
    }
    if (value === null) this.misses++;
    else this.hits++;
    return value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const seconds = ttl ?? this.defaultTTL;
    if (this.redis) {
      await this.redis.set(PREFIX + key, value, 'EX', seconds);
    } else {
      this.memory.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    }
  }

  async delete(key: string): Promise<void> {
    if (this.redis) await this.redis.del(PREFIX + key);
    else this.memory.delete(key);
  }

  async getOrSet(key: string, factory: () => Promise<string>, ttl?: number): Promise<string> {
    const cachedValue = await this.get(key);
    if (cachedValue !== null) return cachedValue;
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /** JSON convenience wrapper around getOrSet. */
  async getOrSetJson<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const raw = await this.getOrSet(key, async () => JSON.stringify(await factory()), ttl);
    return JSON.parse(raw) as T;
  }

  /** Delete every key matching a glob pattern (SCAN, never KEYS, so Redis is not blocked). */
  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.redis) {
      const re = globToRegExp(pattern);
      let removed = 0;
      for (const key of [...this.memory.keys()]) {
        if (re.test(key)) {
          this.memory.delete(key);
          removed++;
        }
      }
      return removed;
    }
    let cursor = '0';
    let removed = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', PREFIX + pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) removed += await this.redis.del(...keys);
    } while (cursor !== '0');
    return removed;
  }

  async clearAll(): Promise<void> {
    await this.invalidatePattern('*');
  }
}
