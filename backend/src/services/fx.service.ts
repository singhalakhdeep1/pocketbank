import { config } from '../config.js';
import { cache, logger } from '../lib/infra.js';

/** Reference rates (USD base) used only when the live rate API cannot be reached. */
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.2,
  JPY: 151.4,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.9,
  CNY: 7.24,
  SGD: 1.35,
  AED: 3.67,
  MXN: 17.1,
  BRL: 5.05,
  ZAR: 18.6,
  SEK: 10.6,
  NOK: 10.8,
  DKK: 6.88,
  NZD: 1.66,
  HKD: 7.82,
  KRW: 1350,
};

export const SUPPORTED_CURRENCIES = Object.keys(FALLBACK_USD_RATES);

interface RateTable {
  base: 'USD';
  rates: Record<string, number>;
  source: 'live' | 'fallback';
  asOf: string;
}

async function usdTable(): Promise<RateTable> {
  return cache.getOrSetJson<RateTable>(
    'fx:usd',
    async () => {
      try {
        const res = await fetch(`${config.fxApi}/latest?base=USD`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`FX API ${res.status}`);
        const json = (await res.json()) as { rates: Record<string, number>; date: string };
        return { base: 'USD', rates: { USD: 1, ...json.rates }, source: 'live', asOf: json.date };
      } catch (err) {
        logger.logWarning('FX API unavailable, using fallback rates', { error: String(err) });
        return { base: 'USD', rates: FALLBACK_USD_RATES, source: 'fallback', asOf: new Date().toISOString().slice(0, 10) };
      }
    },
    3600,
  );
}

export async function getRates() {
  return usdTable();
}

/** Rate to convert 1 unit of `from` into `to`. */
export async function rate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const table = await usdTable();
  const fromRate = table.rates[from] ?? FALLBACK_USD_RATES[from];
  const toRate = table.rates[to] ?? FALLBACK_USD_RATES[to];
  if (!fromRate || !toRate) throw new Error(`Unsupported currency pair ${from}/${to}`);
  return toRate / fromRate;
}
