import {
  resolveLifestyleDate,
  resolveEditableUntil,
  resolveLifeDayMetadata,
  canEditCertification,
  formatKstOffsetIso,
} from '../life-day';

describe('resolveLifestyleDate', () => {
  test('KST 05:00 이후는 당일 생활일', () => {
    // 2026-04-15 06:00 KST = 2026-04-14 21:00 UTC
    expect(resolveLifestyleDate('2026-04-14T21:00:00Z')).toBe('2026-04-15');
  });

  test('KST 05:00 정각은 당일 생활일', () => {
    // 2026-04-15 05:00 KST = 2026-04-14 20:00 UTC
    expect(resolveLifestyleDate('2026-04-14T20:00:00Z')).toBe('2026-04-15');
  });

  test('KST 04:59는 전날 생활일', () => {
    // 2026-04-15 04:59 KST = 2026-04-14 19:59 UTC
    expect(resolveLifestyleDate('2026-04-14T19:59:00Z')).toBe('2026-04-14');
  });

  test('KST 00:00 (자정)은 전날 생활일', () => {
    // 2026-04-15 00:00 KST = 2026-04-14 15:00 UTC
    expect(resolveLifestyleDate('2026-04-14T15:00:00Z')).toBe('2026-04-14');
  });

  test('KST 23:59는 당일 생활일', () => {
    // 2026-04-15 23:59 KST = 2026-04-15 14:59 UTC
    expect(resolveLifestyleDate('2026-04-15T14:59:00Z')).toBe('2026-04-15');
  });

  test('Date 객체도 처리 가능', () => {
    const date = new Date('2026-04-14T21:00:00Z'); // KST 06:00
    expect(resolveLifestyleDate(date)).toBe('2026-04-15');
  });

  test('유효하지 않은 날짜는 에러', () => {
    expect(() => resolveLifestyleDate('invalid')).toThrow('유효하지 않은 날짜');
  });
});

describe('resolveEditableUntil', () => {
  test('수정 기한은 다음날 05:00 KST', () => {
    const result = resolveEditableUntil('2026-04-15');
    // 2026-04-16 05:00 KST = 2026-04-15 20:00 UTC
    expect(result).toBe('2026-04-16T05:00:00+09:00');
  });

  test('월말에도 올바르게 계산', () => {
    const result = resolveEditableUntil('2026-04-30');
    expect(result).toBe('2026-05-01T05:00:00+09:00');
  });

  test('연말에도 올바르게 계산', () => {
    const result = resolveEditableUntil('2026-12-31');
    expect(result).toBe('2027-01-01T05:00:00+09:00');
  });
});

describe('resolveLifeDayMetadata', () => {
  test('메타데이터 전체 반환', () => {
    const result = resolveLifeDayMetadata('2026-04-14T21:00:00Z');

    expect(result.lifestyleDate).toBe('2026-04-15');
    expect(result.editableUntil).toBe('2026-04-16T05:00:00+09:00');
    expect(result.timeZone).toBe('Asia/Seoul');
  });
});

describe('canEditCertification', () => {
  const editableUntil = '2026-04-16T05:00:00+09:00';

  test('기한 전이면 수정 가능', () => {
    // 2026-04-16 04:59 KST = 2026-04-15 19:59 UTC
    const now = new Date('2026-04-15T19:59:00Z');
    expect(canEditCertification(editableUntil, now)).toBe(true);
  });

  test('기한 정각이면 수정 불가', () => {
    // 2026-04-16 05:00 KST = 2026-04-15 20:00 UTC
    const now = new Date('2026-04-15T20:00:00Z');
    expect(canEditCertification(editableUntil, now)).toBe(false);
  });

  test('기한 지나면 수정 불가', () => {
    const now = new Date('2026-04-15T20:01:00Z');
    expect(canEditCertification(editableUntil, now)).toBe(false);
  });
});

describe('formatKstOffsetIso', () => {
  test('UTC를 KST ISO 형식으로 변환', () => {
    const result = formatKstOffsetIso('2026-04-14T21:30:45Z');
    expect(result).toBe('2026-04-15T06:30:45+09:00');
  });
});
