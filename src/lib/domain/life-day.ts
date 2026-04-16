import { APP_TIME_ZONE, LIFE_DAY_CUTOFF_HOUR_KST, type LifeDayMetadata } from './types';

const KST_OFFSET_HOURS = 9;
const KST_OFFSET_MINUTES = KST_OFFSET_HOURS * 60;
const KST_OFFSET_MS = KST_OFFSET_MINUTES * 60 * 1000;

type DateInput = Date | string | number;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDate(input: DateInput) {
  const nextDate = input instanceof Date ? new Date(input.getTime()) : new Date(input);

  if (Number.isNaN(nextDate.getTime())) {
    throw new Error(`유효하지 않은 날짜입니다: ${String(input)}`);
  }

  return nextDate;
}

function getKstParts(input: DateInput) {
  const utcDate = toDate(input);
  const kstDate = new Date(utcDate.getTime() + KST_OFFSET_MS);

  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth() + 1,
    day: kstDate.getUTCDate(),
    hour: kstDate.getUTCHours(),
    minute: kstDate.getUTCMinutes(),
    second: kstDate.getUTCSeconds(),
  };
}

function parseLifeDay(lifestyleDate: string) {
  const [yearText, monthText, dayText] = lifestyleDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    throw new Error(`유효하지 않은 생활일입니다: ${lifestyleDate}`);
  }

  return { year, month, day };
}

function createKstDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - KST_OFFSET_HOURS, minute, second));
}

function formatLifeDayDate(input: DateInput) {
  const parts = getKstParts(input);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatKstOffsetIso(input: DateInput) {
  const parts = getKstParts(input);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}+09:00`;
}

export function resolveLifestyleDate(input: DateInput) {
  const parts = getKstParts(input);
  const baseDate =
    parts.hour < LIFE_DAY_CUTOFF_HOUR_KST
      ? createKstDate(parts.year, parts.month, parts.day - 1)
      : createKstDate(parts.year, parts.month, parts.day);

  return formatLifeDayDate(baseDate);
}

export function resolveEditableUntil(lifestyleDate: string) {
  const { year, month, day } = parseLifeDay(lifestyleDate);
  return formatKstOffsetIso(createKstDate(year, month, day + 1, LIFE_DAY_CUTOFF_HOUR_KST));
}

export function resolveLifeDayMetadata(input: DateInput): LifeDayMetadata {
  const lifestyleDate = resolveLifestyleDate(input);

  return {
    lifestyleDate,
    editableUntil: resolveEditableUntil(lifestyleDate),
    timeZone: APP_TIME_ZONE,
  };
}

export function canEditCertification(editableUntil: DateInput, now: DateInput = new Date()) {
  return toDate(now).getTime() < toDate(editableUntil).getTime();
}
