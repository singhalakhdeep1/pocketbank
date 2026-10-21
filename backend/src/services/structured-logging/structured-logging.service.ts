/**
 * Structured Logging Service for PocketBank (HLD/LLD: Structured Logging)
 * JSON log lines with a per-request correlation ID and user/device context, plus audit events.
 * The request context lives in AsyncLocalStorage, so every log line written while handling a
 * request carries the same correlationId without passing it around.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface LogContext {
  correlationId: string;
  userId?: string;
  accountId?: string;
  transactionId?: string;
  deviceId?: string;
  platform?: string;
  ip?: string;
}

export type LogLevel = 'Debug' | 'Information' | 'Warning' | 'Error' | 'Audit';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  context: LogContext;
  additionalContext?: Record<string, unknown>;
  error?: string;
}

export type AuditSink = (event: {
  eventType: string;
  description: string;
  context: LogContext;
  metadata?: Record<string, unknown>;
}) => Promise<void>;

const levelRank: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class StructuredLoggingService {
  private readonly storage = new AsyncLocalStorage<LogContext>();
  private auditSink: AuditSink | null = null;
  private readonly minRank: number;

  constructor(private readonly service = 'pocketbank-api', level = 'info') {
    this.minRank = levelRank[level] ?? 1;
  }

  /** Run `fn` with `context` attached to every log line it produces. */
  runWithContext<T>(context: LogContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /** Merge fields (e.g. userId once the JWT is verified) into the active request context. */
  enrichContext(fields: Partial<LogContext>): void {
    const current = this.storage.getStore();
    if (current) Object.assign(current, fields);
  }

  setContext(context: LogContext): void {
    this.storage.enterWith(context);
  }

  getContext(): LogContext | null {
    return this.storage.getStore() ?? null;
  }

  setAuditSink(sink: AuditSink): void {
    this.auditSink = sink;
  }

  logDebug(message: string, additionalContext?: Record<string, unknown>): void {
    if (this.minRank > 0) return;
    this.write(this.entry('Debug', message, additionalContext), console.log);
  }

  logInformation(message: string, additionalContext?: Record<string, unknown>): void {
    if (this.minRank > 1) return;
    this.write(this.entry('Information', message, additionalContext), console.log);
  }

  logWarning(message: string, additionalContext?: Record<string, unknown>): void {
    if (this.minRank > 2) return;
    this.write(this.entry('Warning', message, additionalContext), console.warn);
  }

  logError(message: string, error: unknown, additionalContext?: Record<string, unknown>): void {
    const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    this.write(this.entry('Error', message, additionalContext, text), console.error);
  }

  /** Audit events are always written, and also persisted through the audit sink (AuditLog table). */
  logAuditEvent(eventType: string, description: string, additionalContext?: Record<string, unknown>): void {
    const context = { ...additionalContext, auditEventType: eventType, auditDescription: description };
    const entry = this.entry('Audit', `AUDIT: ${description}`, context);
    this.write(entry, console.log);
    if (this.auditSink) {
      this.auditSink({ eventType, description, context: entry.context, metadata: additionalContext }).catch((err) =>
        this.write(this.entry('Error', 'Failed to persist audit event', { eventType }, String(err)), console.error),
      );
    }
  }

  static createCorrelationId(): string {
    return randomUUID();
  }

  private entry(level: LogLevel, message: string, additionalContext?: Record<string, unknown>, error?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      context: { ...(this.storage.getStore() ?? { correlationId: StructuredLoggingService.createCorrelationId() }) },
      ...(additionalContext ? { additionalContext } : {}),
      ...(error ? { error } : {}),
    };
  }

  private write(entry: LogEntry, sink: (line: string) => void): void {
    sink(JSON.stringify(entry));
  }
}
