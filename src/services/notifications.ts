import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const COOLDOWN_MS = 5 * 60 * 1000;
const lastShownMap = new Map<string, number>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('asistencia', {
      name: 'Recordatorios de asistencia',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22B8B0',
    });
  }

  return true;
}

export async function showLocalNotificationOnce(params: {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  cooldownMs?: number;
}) {
  const now = Date.now();
  const cooldown = params.cooldownMs ?? COOLDOWN_MS;
  const lastShownAt = lastShownMap.get(params.id);

  if (lastShownAt && now - lastShownAt < cooldown) {
    return false;
  }

  lastShownMap.set(params.id, now);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      sound: Platform.OS === 'android' ? true : 'default',
      data: params.data ?? {},
    },
    trigger: null,
  });

  return true;
}