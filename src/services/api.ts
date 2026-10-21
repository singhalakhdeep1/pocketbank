/**
 * Typed fetch client for the PocketBank API (no axios). It adds the bearer token from SecureStore,
 * a correlation ID and device headers, and on a 401 refreshes the session once (single-flight, so
 * parallel requests share one refresh) before retrying.
 */
import { Platform } from 'react-native';
import { API_URL } from '../config';
import { RateLimitingService } from './rate-limiting/rate-limiting.service';
import { KEYS, deleteItem, getItem, setItem } from './secureStorage';
import { StructuredLoggingService, logger } from './structured-logging/structured-logging.service';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  body?: unknown;
  query?: Query;
  auth?: boolean;
  /** Adds an Idempotency-Key so retried money movements are applied once. */
  idempotent?: boolean;
  headers?: Record<string, string>;
}

let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

// Client-side throttle for money-moving actions (stops double taps from firing twice).
const mutationLimiter = new RateLimitingService({ capacity: 5, refillPerSecond: 1 });

let deviceId: string | null = null;
async function getDeviceId() {
  if (deviceId) return deviceId;
  deviceId = await getItem(KEYS.deviceId);
  if (!deviceId) {
    deviceId = StructuredLoggingService.createCorrelationId();
    await setItem(KEYS.deviceId, deviceId);
  }
  return deviceId;
}

export function buildUrl(path: string, query?: Query) {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `${API_URL}${path}${qs ? `?${qs}` : ''}`;
}

export async function saveSession(accessToken: string, refreshToken: string) {
  await setItem(KEYS.accessToken, accessToken);
  await setItem(KEYS.refreshToken, refreshToken);
}

export async function clearSession() {
  await deleteItem(KEYS.accessToken);
  await deleteItem(KEYS.refreshToken);
}

let refreshing: Promise<boolean> | null = null;

/** Exchanges the stored refresh token for a new pair. Returns false when the session is gone. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await getItem(KEYS.refreshToken);
      if (!refreshToken) return false;
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device-id': await getDeviceId() },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await clearSession();
        return false;
      }
      const json = (await res.json()) as { accessToken: string; refreshToken: string };
      await saveSession(json.accessToken, json.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();
  return refreshing;
}

async function headersFor(opts: RequestOptions, correlationId: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-correlation-id': correlationId,
    'x-device-id': await getDeviceId(),
    'x-platform': Platform.OS,
    ...opts.headers,
  };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) headers['content-type'] = 'application/json';
  if (opts.auth !== false) {
    const token = await getItem(KEYS.accessToken);
    if (token) headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseError(res: Response): Promise<ApiError> {
  let payload: { error?: { code?: string; message?: string; details?: unknown } } = {};
  try {
    payload = await res.json();
  } catch {
    /* non-JSON error */
  }
  return new ApiError(res.status, payload.error?.code ?? `HTTP_${res.status}`, payload.error?.message ?? `Request failed (${res.status})`, payload.error?.details);
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  if (method !== 'GET' && opts.idempotent && !(await mutationLimiter.isAllowed('mutation'))) {
    throw new ApiError(429, 'TOO_FAST', 'Please wait a moment before trying again');
  }
  const correlationId = StructuredLoggingService.createCorrelationId();
  const idempotencyKey = opts.idempotent ? `app-${correlationId}` : undefined;
  const send = async () =>
    fetch(buildUrl(path, opts.query), {
      method,
      headers: { ...(await headersFor(opts, correlationId)), ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) },
      body: opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
    });

  let res: Response;
  try {
    res = await send();
  } catch (err) {
    logger.logError('Network request failed', err, { method, path, correlationId });
    throw new ApiError(0, 'NETWORK', `Cannot reach PocketBank (${API_URL}). Check your connection.`);
  }
  if (res.status === 401 && opts.auth !== false) {
    if (await refreshSession()) res = await send();
    else {
      onSessionExpired?.();
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session expired, please sign in again');
    }
  }
  if (!res.ok) {
    const error = await parseError(res);
    logger.logWarning('API error', { method, path, status: res.status, code: error.code, correlationId });
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'body'> = {}) => request<T>('POST', path, { ...opts, body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};

/** Authenticated GET that returns raw bytes (CSV/PDF exports, receipts). */
export async function download(path: string, query?: Query): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  const go = async () => fetch(buildUrl(path, query), { headers: await headersFor({}, StructuredLoggingService.createCorrelationId()) });
  let res = await go();
  if (res.status === 401 && (await refreshSession())) res = await go();
  if (!res.ok) throw await parseError(res);
  const disposition = res.headers.get('content-disposition') ?? '';
  const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? path.split('/').pop() ?? 'download';
  return { blob: await res.blob(), fileName, contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
}

export async function authHeader(): Promise<Record<string, string>> {
  const token = await getItem(KEYS.accessToken);
  return token ? { authorization: `Bearer ${token}` } : {};
}

export default api;
