import { createApp } from './app.js';
import { config } from './config.js';
import { logger, prisma, redis } from './lib/infra.js';
import { startScheduler, stopScheduler } from './services/scheduler.service.js';

const app = createApp();
const server = app.listen(config.port, () => {
  logger.logInformation('PocketBank API listening', { port: config.port, env: config.nodeEnv, cache: redis ? 'redis' : 'memory' });
  startScheduler();
});

async function shutdown(signal: string) {
  logger.logInformation('Shutting down', { signal });
  stopScheduler();
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis?.quit()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.logError('Unhandled promise rejection', err));
