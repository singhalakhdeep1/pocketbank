import { config } from '../config.js';
import { logger, prisma } from '../lib/infra.js';

export type NotificationType = 'transaction' | 'security' | 'budget' | 'bill' | 'investment' | 'split' | 'system';

const prefField: Partial<Record<NotificationType, 'notifyTransactions' | 'notifySecurity' | 'notifyBudget'>> = {
  transaction: 'notifyTransactions',
  security: 'notifySecurity',
  budget: 'notifyBudget',
  bill: 'notifyBudget',
};

/**
 * Stores an in-app notification and, when the user registered an Expo push token and has that
 * category enabled, delivers it through the Expo push service.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const notification = await prisma.notification.create({
      data: { userId, type, title, body, data: (data ?? {}) as object },
    });
    const field = prefField[type];
    const wantsPush = field ? user[field] : true;
    if (!user.pushToken || !wantsPush) return;

    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    if (config.expoAccessToken) headers.authorization = `Bearer ${config.expoAccessToken}`;
    const res = await fetch(config.expoPushUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to: user.pushToken, title, body, sound: 'default', data: { ...data, type, notificationId: notification.id } }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { status?: string; details?: { error?: string } } };
    const status = json.data?.status ?? (res.ok ? 'ok' : `http_${res.status}`);
    await prisma.notification.update({ where: { id: notification.id }, data: { pushStatus: status } });
    if (json.data?.details?.error === 'DeviceNotRegistered') {
      await prisma.user.update({ where: { id: userId }, data: { pushToken: null } });
    }
  } catch (err) {
    logger.logError('Notification delivery failed', err, { userId, type });
  }
}
