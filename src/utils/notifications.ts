import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { EAS_PROJECT_ID } from '../config';
import { bank } from '../services/bank';
import { logger } from '../services/structured-logging/structured-logging.service';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export type PushResult = { status: 'registered'; token: string } | { status: 'unavailable'; reason: string };

/**
 * Asks for permission, gets the Expo push token and registers it with the API so transaction,
 * security and budget alerts arrive as push notifications. Remote push needs a physical device and
 * a development/production build (Expo Go no longer delivers remote push on Android).
 */
export async function registerForPushNotifications(): Promise<PushResult> {
  if (Platform.OS === 'web') return { status: 'unavailable', reason: 'Push notifications are not available on web' };
  if (!Device.isDevice) return { status: 'unavailable', reason: 'Push notifications need a physical device' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Account alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1976d2',
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  const finalStatus = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== 'granted') return { status: 'unavailable', reason: 'Notification permission was not granted' };
  try {
    const projectId = EAS_PROJECT_ID ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await bank.profile.registerPush(token);
    return { status: 'registered', token };
  } catch (err) {
    logger.logWarning('Push registration failed', { error: String(err) });
    return { status: 'unavailable', reason: 'Remote push needs a development build with an EAS project id' };
  }
}

export const sendLocalNotification = async (title: string, body: string) => {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({ content: { title, body, sound: true }, trigger: null });
};
