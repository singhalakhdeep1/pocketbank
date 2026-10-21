/**
 * Market data. Crypto prices come from Coinbase (public, no key). Stocks, ETFs, funds and bonds come
 * from Alpha Vantage when ALPHA_VANTAGE_KEY is set; without a key a deterministic simulated feed is
 * used and every quote says `source: "simulated"` so the app can label it.
 */
import { createHash } from 'node:crypto';
import type { AssetType } from '../generated/prisma/enums.js';
import { config } from '../config.js';
import { notFound, unavailable } from '../lib/errors.js';
import { cache, logger } from '../lib/infra.js';

export interface Instrument {
  symbol: string;
  name: string;
  assetType: AssetType;
  basePrice: number;
}

export const INSTRUMENTS: Instrument[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'STOCK', basePrice: 228 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', assetType: 'STOCK', basePrice: 425 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', assetType: 'STOCK', basePrice: 172 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', assetType: 'STOCK', basePrice: 186 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', assetType: 'STOCK', basePrice: 128 },
  { symbol: 'TSLA', name: 'Tesla Inc.', assetType: 'STOCK', basePrice: 245 },
  { symbol: 'META', name: 'Meta Platforms Inc.', assetType: 'STOCK', basePrice: 560 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', assetType: 'STOCK', basePrice: 215 },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', assetType: 'ETF', basePrice: 520 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', assetType: 'ETF', basePrice: 480 },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', assetType: 'ETF', basePrice: 280 },
  { symbol: 'SCHD', name: 'Schwab US Dividend Equity ETF', assetType: 'ETF', basePrice: 82 },
  { symbol: 'VFIAX', name: 'Vanguard 500 Index Admiral', assetType: 'MUTUAL_FUND', basePrice: 510 },
  { symbol: 'FXAIX', name: 'Fidelity 500 Index Fund', assetType: 'MUTUAL_FUND', basePrice: 195 },
  { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', assetType: 'BOND', basePrice: 73 },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', assetType: 'BOND', basePrice: 92 },
  { symbol: 'BTC', name: 'Bitcoin', assetType: 'CRYPTO', basePrice: 65000 },
  { symbol: 'ETH', name: 'Ethereum', assetType: 'CRYPTO', basePrice: 2500 },
  { symbol: 'SOL', name: 'Solana', assetType: 'CRYPTO', basePrice: 150 },
  { symbol: 'USDC', name: 'USD Coin', assetType: 'CRYPTO', basePrice: 1 },
  { symbol: 'ADA', name: 'Cardano', assetType: 'CRYPTO', basePrice: 0.45 },
  { symbol: 'DOGE', name: 'Dogecoin', assetType: 'CRYPTO', basePrice: 0.12 },
  { symbol: 'LINK', name: 'Chainlink', assetType: 'CRYPTO', basePrice: 13 },
];

export interface Quote {
  symbol: string;
  name: string;
  assetType: AssetType;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  source: 'coinbase' | 'alphavantage' | 'simulated';
  asOf: string;
  /** True when the live feed was unreachable and this is the last known live price. */
  stale?: boolean;
}

export interface PricePoint {
  date: string;
  close: number;
}

export function instrument(symbol: string): Instrument {
  const found = INSTRUMENTS.find((i) => i.symbol === symbol.toUpperCase());
  if (!found) throw notFound(`Instrument ${symbol}`);
  return found;
}

// ---------------- simulated feed (deterministic per symbol and day) ----------------

function unit(seed: string): number {
  return createHash('sha256').update(seed).digest().readUInt32BE(0) / 0xffffffff;
}

function simulatedClose(inst: Instrument, day: Date): number {
  if (inst.symbol === 'USDC') return 1;
  // Random walk anchored at basePrice; each day's move is derived from a hash so it is stable.
  const epoch = Math.floor(day.getTime() / 86_400_000);
  const vol = inst.assetType === 'CRYPTO' ? 0.035 : inst.assetType === 'BOND' ? 0.004 : 0.015;
  let price = inst.basePrice;
  for (let d = epoch - 120; d <= epoch; d++) {
    price *= 1 + (unit(`${inst.symbol}:${d}`) - 0.48) * 2 * vol;
  }
  return Number(price.toFixed(price < 5 ? 4 : 2));
}

function simulatedQuote(inst: Instrument): Quote {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  // Small intraday drift so prices move during the day.
  const intraday = 1 + (unit(`${inst.symbol}:${Math.floor(Date.now() / 300_000)}`) - 0.5) * 0.004;
  const price = Number((simulatedClose(inst, today) * (inst.symbol === 'USDC' ? 1 : intraday)).toFixed(4));
  const previousClose = simulatedClose(inst, yesterday);
  return buildQuote(inst, price, previousClose, 'simulated');
}

function buildQuote(inst: Instrument, price: number, previousClose: number, source: Quote['source']): Quote {
  const change = price - previousClose;
  return {
    symbol: inst.symbol,
    name: inst.name,
    assetType: inst.assetType,
    price: Number(price.toFixed(price < 5 ? 4 : 2)),
    previousClose,
    change: Number(change.toFixed(4)),
    changePercent: previousClose ? Number(((change / previousClose) * 100).toFixed(2)) : 0,
    source,
    asOf: new Date().toISOString(),
  };
}

// ---------------- live providers ----------------

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'pocketbank-api' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function coinbaseQuote(inst: Instrument): Promise<Quote> {
  const spot = await getJson<{ data: { amount: string } }>(`${config.coinbaseApi}/v2/prices/${inst.symbol}-USD/spot`);
  const price = Number(spot.data.amount);
  const day = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  let previous = price;
  try {
    const hist = await getJson<{ data: { amount: string } }>(`${config.coinbaseApi}/v2/prices/${inst.symbol}-USD/spot?date=${day}`);
    previous = Number(hist.data.amount);
  } catch {
    /* change stays 0 */
  }
  return buildQuote(inst, price, previous, 'coinbase');
}

async function alphaVantageQuote(inst: Instrument): Promise<Quote> {
  const json = await getJson<{ 'Global Quote'?: Record<string, string>; Note?: string; Information?: string }>(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${inst.symbol}&apikey=${config.alphaVantageKey}`,
  );
  const q = json['Global Quote'];
  if (!q?.['05. price']) throw new Error(json.Note ?? json.Information ?? 'Alpha Vantage returned no quote');
  return buildQuote(inst, Number(q['05. price']), Number(q['08. previous close']), 'alphavantage');
}

export async function quote(symbol: string): Promise<Quote> {
  const inst = instrument(symbol);
  const key = `quote:${inst.symbol}`;
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached) as Quote;

  const live = inst.assetType === 'CRYPTO' || Boolean(config.alphaVantageKey);
  if (live) {
    try {
      const q = inst.assetType === 'CRYPTO' ? await coinbaseQuote(inst) : await alphaVantageQuote(inst);
      await cache.set(key, JSON.stringify(q), 60);
      await cache.set(`quote:last:${inst.symbol}`, JSON.stringify(q), 86_400);
      return q;
    } catch (err) {
      // Never invent a price for something that has a live feed: reuse the last live quote, marked stale.
      const last = await cache.get(`quote:last:${inst.symbol}`);
      logger.logWarning('Live quote failed', { symbol: inst.symbol, error: String(err), fallback: last ? 'last-known' : 'simulated' });
      if (last) {
        const q = { ...(JSON.parse(last) as Quote), stale: true };
        await cache.set(key, JSON.stringify(q), 10);
        return q;
      }
    }
  }
  const q = simulatedQuote(inst);
  await cache.set(key, JSON.stringify(q), live ? 10 : 60);
  return q;
}

export async function quotes(symbols: string[]): Promise<Quote[]> {
  return Promise.all(symbols.map((s) => quote(s)));
}

export async function history(symbol: string, days = 30): Promise<{ source: Quote['source']; points: PricePoint[] }> {
  const inst = instrument(symbol);
  const span = Math.min(Math.max(days, 2), 365);
  return cache.getOrSetJson(
    `history:${inst.symbol}:${span}`,
    async () => {
      try {
        if (inst.assetType === 'CRYPTO') {
          // Coinbase Exchange daily candles: [time, low, high, open, close, volume]
          const candles = await getJson<number[][]>(
            `https://api.exchange.coinbase.com/products/${inst.symbol}-USD/candles?granularity=86400`,
          );
          const points = candles
            .slice(0, span)
            .reverse()
            .map((c) => ({ date: new Date(c[0] * 1000).toISOString().slice(0, 10), close: c[4] }));
          if (points.length > 1) return { source: 'coinbase' as const, points };
        } else if (config.alphaVantageKey) {
          const json = await getJson<{ 'Time Series (Daily)'?: Record<string, Record<string, string>> }>(
            `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${inst.symbol}&apikey=${config.alphaVantageKey}`,
          );
          const series = json['Time Series (Daily)'];
          if (series) {
            const points = Object.entries(series)
              .slice(0, span)
              .reverse()
              .map(([date, v]) => ({ date, close: Number(v['4. close']) }));
            return { source: 'alphavantage' as const, points };
          }
        }
      } catch (err) {
        logger.logWarning('Live history failed, using simulated series', { symbol: inst.symbol, error: String(err) });
      }
      const points: PricePoint[] = [];
      for (let i = span - 1; i >= 0; i--) {
        const day = new Date(Date.now() - i * 86_400_000);
        points.push({ date: day.toISOString().slice(0, 10), close: simulatedClose(inst, day) });
      }
      return { source: 'simulated' as const, points };
    },
    900,
  );
}

export function search(term: string): Instrument[] {
  const q = term.trim().toLowerCase();
  if (!q) return INSTRUMENTS;
  return INSTRUMENTS.filter((i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
}

export function assertTradable(price: number) {
  if (!Number.isFinite(price) || price <= 0) throw unavailable('No price available for this instrument right now');
}
