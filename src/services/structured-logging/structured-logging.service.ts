/**
 * Structured Logging Service (HLD/LLD) — client side. JSON log entries with a correlation ID and
 * user/device context. Every API request sends its correlation ID as `x-correlation-id`, so a log
 * line on the phone can be matched to the API's log line for the same request.
 */
import { Platform } from 'react-native';

export interface LogContext {
  correlationId: string;
  userId?: string;
  accountId?: string;
  transactionId?: string;
  deviceId?: string;
  platform?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'Information' | 'Warning' | 'Error' | 'Audit';
  message: string;
  context: LogContext;
  additionalContext?: Record<string, unknown>;
  error?: string;
}

function uuid(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class StructuredLoggingService {
  private currentContext: LogContext | null = null;
  private readonly buffer: LogEntry[] = [];

  setContext(context: Partial<LogContext>): void {
    this.currentContext = { correlationId: this.currentContext?.correlationId ?? uuid(), platform: Platform.OS, ...this.currentContext, ...context };
  }

  getContext(): LogContext | null {
    return this.currentContext;
  }

  /** Most recent entries (kept in memory) for the diagnostics section of the profile screen. */
  recent(limit = 50): LogEntry[] {
    return this.buffer.slice(-limit).reverse();
  }

  logInformation(message: string, additionalContext?: Record<string, unknown>): void {
    this.emit(this.entry('Information', message, additionalContext));
  }

  logWarning(message: string, additionalContext?: Record<string, unknown>): void {
    this.emit(this.entry('Warning', message, additionalContext));
  }

  logError(message: string, error: unknown, additionalContext?: Record<string, unknown>): void {
    this.emit(this.entry('Error', message, additionalContext, error instanceof Error ? error.message : String(error)));
  }

  logAuditEvent(eventType: string, description: string, additionalContext?: Record<string, unknown>): void {
    this.emit(this.entry('Audit', `AUDIT: ${description}`, { ...additionalContext, auditEventType: eventType, auditDescription: description }));
  }

  static createCorrelationId(): string {
    return uuid();
  }

  private entry(level: LogEntry['level'], message: string, additionalContext?: Record<string, unknown>, error?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.currentContext ?? { correlationId: uuid(), platform: Platform.OS },
      ...(additionalContext ? { additionalContext } : {}),
      ...(error ? { error } : {}),
    };
  }

  private emit(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > 200) this.buffer.shift();
    if (__DEV__ || entry.level === 'Error') {
      const line = JSON.stringify(entry);
      if (entry.level === 'Error') console.error(line);
      else if (entry.level === 'Warning') console.warn(line);
      else console.log(line);
    }
  }
}

export const logger = new StructuredLoggingService();
