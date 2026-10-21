import client from 'prom-client';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'pocketbank_' });

export const httpDuration = new client.Histogram({
  name: 'pocketbank_http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const moneyMoved = new client.Counter({
  name: 'pocketbank_money_moved_total',
  help: 'Amount moved through the ledger, by transaction kind',
  labelNames: ['kind', 'currency'],
  registers: [registry],
});

export const rateLimited = new client.Counter({
  name: 'pocketbank_rate_limited_total',
  help: 'Requests rejected by the token bucket',
  labelNames: ['bucket'],
  registers: [registry],
});

export const authEvents = new client.Counter({
  name: 'pocketbank_auth_events_total',
  help: 'Authentication events',
  labelNames: ['event'],
  registers: [registry],
});

export const schedulerRuns = new client.Counter({
  name: 'pocketbank_scheduler_jobs_total',
  help: 'Scheduler job executions',
  labelNames: ['job', 'result'],
  registers: [registry],
});
