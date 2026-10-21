import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const key = createHash('sha256').update(config.dataKey).digest();

/** AES-256-GCM; output is base64(iv | tag | ciphertext). Used for card PAN/CVV and TOTP secrets at rest. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
/** Keyed hash for lookups of secrets (card numbers) without storing them in clear. */
export const lookupHash = (value: string) => createHmac('sha256', key).update(value).digest('hex');
export const randomToken = (bytes = 48) => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}

/** Luhn check digit so generated card numbers pass standard validation. */
export function luhnComplete(partial: string): string {
  let sum = 0;
  const digits = partial.split('').reverse().map(Number);
  digits.forEach((d, i) => {
    let v = d;
    if (i % 2 === 0) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  });
  return partial + ((10 - (sum % 10)) % 10).toString();
}

export function luhnValid(pan: string): boolean {
  return /^\d{12,19}$/.test(pan) && luhnComplete(pan.slice(0, -1)) === pan;
}

// ---- TOTP (RFC 6238, SHA-1, 30 s, 6 digits) — what Google Authenticator / Authy expect ----

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totp(secretBase32: string, time = Date.now(), step = 30): string {
  const counter = Math.floor(time / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

/** Accepts the current code and one step either side to allow for clock drift. */
export function verifyTotp(secretBase32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((drift) => safeEqual(totp(secretBase32, Date.now() + drift * 30_000), code));
}

export const newTotpSecret = () => base32Encode(randomBytes(20));
