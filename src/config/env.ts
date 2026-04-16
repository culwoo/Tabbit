const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const amplitudeApiKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY ?? '';
const crashlyticsEnabled = process.env.EXPO_PUBLIC_ENABLE_CRASHLYTICS === 'true';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const missingSupabaseEnv = [
  supabaseUrl ? null : 'EXPO_PUBLIC_SUPABASE_URL',
  supabasePublishableKey ? null : 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY)',
].filter(Boolean) as string[];

export const env = {
  appEnv,
  isDevelopment: appEnv !== 'production',
  amplitudeApiKey,
  crashlyticsEnabled,
  supabaseUrl,
  supabasePublishableKey,
  hasSupabaseConfig: missingSupabaseEnv.length === 0,
  missingSupabaseEnv,
} as const;
