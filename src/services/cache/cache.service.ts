/**
 * Cache Service (HLD/LLD) — client side. A TTL cache on AsyncStorage with the same API as the
 * backend's Redis cache (get / set / delete / getOrSet / invalidatePattern). The app uses it to show
 * the last known dashboard and accounts instantly and when offline; the API keeps the shared Redis
 * cache.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Entry {
  value: string;
  expiresAt: number;
}

const PREFIX = 'pbcache:';

function globToRegExp(pattern: string): RegExp {
  return new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
}

export class CacheService {
  constructor(private readonly defaultTTL = 3600) {}

  async get(key: string, { allowStale = false } = {}): Promise<string | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as Entry;
      if (entry.expiresAt > Date.now() || allowStale) return entry.value;
      await AsyncStorage.removeItem(PREFIX + key);
      return null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const entry: Entry = { value, expiresAt: Date.now() + (ttl ?? this.defaultTTL) * 1000 };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry)).catch(() => undefined);
  }

  async delete(key: string): Promise<void> {
    await AsyncStorage.removeItem(PREFIX + key).catch(() => undefined);
  }

  async getOrSet(key: string, factory: () => Promise<string>, ttl?: number): Promise<string> {
    const cachedValue = await this.get(key);
    if (cachedValue !== null) return cachedValue;
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const re = globToRegExp(pattern);
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX) && re.test(k.slice(PREFIX.length)));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  }

  async clearAll(): Promise<void> {
    await this.invalidatePattern('*');
  }
}

export const cache = new CacheService(24 * 3600);
