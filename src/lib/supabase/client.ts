import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';

import { env } from '@/config/env';

let isAutoRefreshBound = false;

export const supabase = env.hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;

if (Platform.OS !== 'web' && supabase && !isAutoRefreshBound) {
  isAutoRefreshBound = true;
  supabase.auth.startAutoRefresh();

  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      supabase.auth.startAutoRefresh();
      return;
    }

    supabase.auth.stopAutoRefresh();
  });
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      `Supabase 환경변수가 비어 있습니다: ${env.missingSupabaseEnv.join(', ') || 'unknown variables'}`,
    );
  }

  return supabase;
}
