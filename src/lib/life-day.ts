export {
  canEditCertification,
  formatKstOffsetIso,
  resolveEditableUntil,
  resolveLifeDayMetadata,
  resolveLifestyleDate,
} from '@/lib/domain';

const lifeDayFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

const timestampFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatLifeDayLabel(lifeDay: string) {
  const date = new Date(`${lifeDay}T12:00:00+09:00`);
  return lifeDayFormatter.format(date);
}

export function formatTimestampLabel(isoTimestamp?: string) {
  if (!isoTimestamp) {
    return '시간 미정';
  }

  return timestampFormatter.format(new Date(isoTimestamp));
}

export function isArchiveLifeDay(currentLifeDay: string, targetLifeDay?: string) {
  return Boolean(targetLifeDay && targetLifeDay !== currentLifeDay);
}
