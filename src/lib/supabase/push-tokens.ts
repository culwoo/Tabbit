import { requireSupabase } from './client';
import type { PushTokenRow } from './database-types';

export type PushTokenPlatform = 'android' | 'ios' | 'web' | 'unknown';

const db = () => requireSupabase();

export async function registerPushToken(params: {
  expoPushToken: string;
  platform: PushTokenPlatform;
  deviceId: string;
}) {
  const { data, error } = await db().rpc('register_push_token', {
    p_device_id: params.deviceId,
    p_expo_push_token: params.expoPushToken,
    p_platform: params.platform,
  });

  if (error) throw error;
  return data as PushTokenRow;
}

export async function disablePushToken(expoPushToken: string, deviceId?: string | null) {
  const { error } = await db().rpc('disable_push_token', {
    p_device_id: deviceId ?? null,
    p_expo_push_token: expoPushToken,
  });

  if (error) throw error;
}
