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

function logPrefix(channel: 'Amplitude' | 'Crashlytics') {
  return `[${channel}:${env.appEnv}]`;
}

export function trackEvent(eventName: AnalyticsEventName, context: MonitoringContext) {
  if (__DEV__) {
    console.log(logPrefix('Amplitude'), eventName, context);
  }
}

export function captureHandledError(error: unknown, context: MonitoringContext) {
  const normalizedError =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: 'UnknownError', message: String(error) };

  console.error(logPrefix('Crashlytics'), normalizedError, context);
}
