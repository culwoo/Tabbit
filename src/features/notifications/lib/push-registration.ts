import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { disablePushToken, registerPushToken, type PushTokenPlatform } from '@/lib/supabase';

export const PUSH_CHANNEL_ID = 'tabbit-default';

const PUSH_REGISTRATION_STORAGE_KEY = 'tabbit.pushRegistration.v1';
const INSTALLATION_ID_STORAGE_KEY = 'tabbit.installationId.v1';

type CachedPushRegistration = {
  userId: string;
  expoPushToken: string;
  platform: PushTokenPlatform;
  deviceId: string;
};

export async function syncPushRegistration(userId: string | null) {
  const cached = await readCachedPushRegistration();

  if (!userId) {
    if (cached) {
      await deactivateCurrentPushRegistration();
    }
    return;
  }

  const nextRegistration = await registerForPushNotificationsAsync();

  if (!nextRegistration) {
    return;
  }

  if (cached && cached.userId !== userId) {
    await disablePushToken(cached.expoPushToken, cached.deviceId).catch((error) => {
      console.warn('[PushNotifications] previous token disable error:', error);
    });
  }

  await registerPushToken(nextRegistration);
  await AsyncStorage.setItem(
    PUSH_REGISTRATION_STORAGE_KEY,
    JSON.stringify({ ...nextRegistration, userId }),
  );
}

export async function deactivateCurrentPushRegistration() {
  const cached = await readCachedPushRegistration();

  if (!cached) {
    return;
  }

  try {
    await disablePushToken(cached.expoPushToken, cached.deviceId);
  } finally {
    await AsyncStorage.removeItem(PUSH_REGISTRATION_STORAGE_KEY);
  }
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    console.log('[PushNotifications] physical device required for push tokens.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      name: 'Tabbit activity',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;

  if (finalStatus !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== 'granted') {
    console.log('[PushNotifications] notification permission was not granted.');
    return null;
  }

  const projectId = resolveExpoProjectId();
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  return {
    deviceId: await getInstallationId(),
    expoPushToken: token.data,
    platform: resolvePlatform(),
  };
}

function resolvePlatform(): PushTokenPlatform {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
    return Platform.OS;
  }

  return 'unknown';
}

function resolveExpoProjectId() {
  const easConfig = Constants.easConfig as { projectId?: string } | undefined;
  const expoConfig = Constants.expoConfig as
    | { extra?: { eas?: { projectId?: string } } }
    | undefined;

  return easConfig?.projectId ?? expoConfig?.extra?.eas?.projectId ?? null;
}

async function getInstallationId() {
  const existingId = await AsyncStorage.getItem(INSTALLATION_ID_STORAGE_KEY);

  if (existingId) {
    return existingId;
  }

  const nextId = `rn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(INSTALLATION_ID_STORAGE_KEY, nextId);
  return nextId;
}

async function readCachedPushRegistration() {
  const raw = await AsyncStorage.getItem(PUSH_REGISTRATION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CachedPushRegistration;
  } catch {
    await AsyncStorage.removeItem(PUSH_REGISTRATION_STORAGE_KEY);
    return null;
  }
}
