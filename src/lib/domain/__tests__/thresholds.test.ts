import {
  resolveEffectiveThreshold,
  formatThresholdSummary,
  countDistinctCertifiedMembers,
  computeThresholdComputation,
} from '../thresholds';

describe('resolveEffectiveThreshold', () => {
  describe('ALL 규칙', () => {
    test('전원 필요', () => {
      expect(resolveEffectiveThreshold('ALL', 4)).toBe(4);
    });

    test('1명이어도 1명 필요', () => {
      expect(resolveEffectiveThreshold('ALL', 1)).toBe(1);
    });
  });

  describe('N_MINUS_1 규칙', () => {
    test('4명 중 3명 필요', () => {
      expect(resolveEffectiveThreshold('N_MINUS_1', 4)).toBe(3);
    });

    test('2명이면 전원 필요', () => {
      expect(resolveEffectiveThreshold('N_MINUS_1', 2)).toBe(2);
    });

    test('1명이면 최소 1명 (0 미만으로 내려가지 않음)', () => {
      expect(resolveEffectiveThreshold('N_MINUS_1', 1)).toBe(1);
    });
  });

  describe('N_MINUS_2 규칙', () => {
    test('6명 중 4명 필요', () => {
      expect(resolveEffectiveThreshold('N_MINUS_2', 6)).toBe(4);
    });

    test('3명이면 최소 1명', () => {
      expect(resolveEffectiveThreshold('N_MINUS_2', 3)).toBe(1);
    });

    test('2명이면 전원 필요', () => {
      expect(resolveEffectiveThreshold('N_MINUS_2', 2)).toBe(2);
    });
  });

  describe('경계 조건', () => {
    test('멤버 0명이면 0', () => {
      expect(resolveEffectiveThreshold('ALL', 0)).toBe(0);
      expect(resolveEffectiveThreshold('N_MINUS_1', 0)).toBe(0);
      expect(resolveEffectiveThreshold('N_MINUS_2', 0)).toBe(0);
    });

    test('음수 멤버도 0', () => {
      expect(resolveEffectiveThreshold('ALL', -1)).toBe(0);
    });
  });
});

describe('formatThresholdSummary', () => {
  test('ALL이고 전원이면 "모두 인증"', () => {
    expect(formatThresholdSummary('ALL', 4)).toBe('모두 인증');
  });

  test('N-1이면 "3/4명 인증"', () => {
    expect(formatThresholdSummary('N_MINUS_1', 4)).toBe('3/4명 인증');
  });

  test('N-2이면 "4/6명 인증"', () => {
    expect(formatThresholdSummary('N_MINUS_2', 6)).toBe('4/6명 인증');
  });

  test('0명이면 "대상 없음"', () => {
    expect(formatThresholdSummary('ALL', 0)).toBe('대상 없음');
  });
});

describe('countDistinctCertifiedMembers', () => {
  test('중복 제거', () => {
    expect(countDistinctCertifiedMembers(['a', 'b', 'a', 'c'])).toBe(3);
  });

  test('빈 문자열 필터링', () => {
    expect(countDistinctCertifiedMembers(['a', '', 'b', ''])).toBe(2);
  });

  test('빈 배열은 0', () => {
    expect(countDistinctCertifiedMembers([])).toBe(0);
  });
});

describe('computeThresholdComputation', () => {
  const members = ['alice', 'bob', 'charlie', 'diana'];

  test('임계값 미달 → locked', () => {
    const result = computeThresholdComputation({
      eligibleMemberIds: members,
      certifiedMemberIds: ['alice', 'bob'],
      thresholdRule: 'N_MINUS_1',
    });

    expect(result.eligibleMemberCount).toBe(4);
    expect(result.effectiveThreshold).toBe(3);
    expect(result.certifiedMemberCount).toBe(2);
    expect(result.meetsThreshold).toBe(false);
    expect(result.thresholdStateStatus).toBe('locked');
    expect(result.storyCardStatus).toBe('locked');
  });

  test('임계값 충족 → provisional_unlocked', () => {
    const result = computeThresholdComputation({
      eligibleMemberIds: members,
      certifiedMemberIds: ['alice', 'bob', 'charlie'],
      thresholdRule: 'N_MINUS_1',
    });

    expect(result.meetsThreshold).toBe(true);
    expect(result.thresholdStateStatus).toBe('provisional_unlocked');
    expect(result.storyCardStatus).toBe('provisional');
  });

  test('전원 인증 + finalized → finalized', () => {
    const result = computeThresholdComputation({
      eligibleMemberIds: members,
      certifiedMemberIds: ['alice', 'bob', 'charlie', 'diana'],
      thresholdRule: 'ALL',
      finalized: true,
    });

    expect(result.meetsThreshold).toBe(true);
    expect(result.thresholdStateStatus).toBe('finalized');
    expect(result.storyCardStatus).toBe('finalized');
  });

  test('finalized인데 미달 → expired/locked', () => {
    const result = computeThresholdComputation({
      eligibleMemberIds: members,
      certifiedMemberIds: ['alice'],
      thresholdRule: 'ALL',
      finalized: true,
    });

    expect(result.meetsThreshold).toBe(false);
    expect(result.thresholdStateStatus).toBe('expired');
    expect(result.storyCardStatus).toBe('locked');
  });

  test('이전에 언락됐다가 인증 삭제 → revoked', () => {
    const result = computeThresholdComputation({
      eligibleMemberIds: members,
      certifiedMemberIds: ['alice', 'bob'],
      thresholdRule: 'N_MINUS_1',
      previouslyUnlocked: true,
    });

    expect(result.meetsThreshold).toBe(false);
    expect(result.storyCardStatus).toBe('revoked');
  });

  test('eligible 0명이면 meetsThreshold는 false', () => {
    const result = computeThresholdComputation({
      eligibleMemberIds: [],
      certifiedMemberIds: [],
      thresholdRule: 'ALL',
    });

    expect(result.eligibleMemberCount).toBe(0);
    expect(result.effectiveThreshold).toBe(0);
    expect(result.meetsThreshold).toBe(false);
  });

  test('중복 멤버 ID는 dedupe', () => {
    const result = computeThresholdComputation({
      eligibleMemberIds: ['alice', 'alice', 'bob'],
      certifiedMemberIds: ['alice', 'alice'],
      thresholdRule: 'ALL',
    });

    expect(result.eligibleMemberCount).toBe(2);
    expect(result.certifiedMemberCount).toBe(1);
  });
});
