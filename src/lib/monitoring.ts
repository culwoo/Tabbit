import { env } from '@/config/env';

type MonitoringContext = {
  userId?: string;
  groupId?: string;
  tagId?: string;
  lifeDay?: string;
  exportStage?: string;
  reason?: string;
  [key: string]: string | number | boolean | undefined;
};

export type AnalyticsEventName =
  | 'threshold_unlocked'
  | 'share_mode_opened'
  | 'share_export_started'
  | 'share_export_succeeded'
  | 'share_export_failed'
  | 'share_sheet_opened'
  | 'snapshot_saved';

function logPrefix(channel: 'analytics' | 'errors') {
  return `[monitoring:${channel}:${env.appEnv}]`;
}

function shouldLogToConsole() {
  return __DEV__ || env.appEnv !== 'production';
}

export function getMonitoringStatus() {
  return {
    analytics: env.amplitudeApiKey ? 'configured_pending_sdk' : 'disabled',
    crashReporting: env.crashlyticsEnabled ? 'enabled_pending_sdk' : 'disabled',
  } as const;
}

export function trackEvent(eventName: AnalyticsEventName, context: MonitoringContext) {
  if (shouldLogToConsole()) {
    console.log(logPrefix('analytics'), eventName, context);
  }
}

export function captureHandledError(error: unknown, context: MonitoringContext) {
  const normalizedError =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: 'UnknownError', message: String(error) };

  if (shouldLogToConsole() || env.crashlyticsEnabled) {
    console.error(logPrefix('errors'), normalizedError, context);
  }
}
