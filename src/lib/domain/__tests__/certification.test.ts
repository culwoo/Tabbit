import {
  normalizeTagLabel,
  formatTagLabel,
  dedupeTagLabels,
  createCertificationCommand,
  resolveGroupShareTargets,
  resolveCertificationDraft,
} from '../certification';
import type { GroupTagDirectoryEntry } from '../types';

describe('normalizeTagLabel', () => {
  test('소문자 변환', () => {
    expect(normalizeTagLabel('운동')).toBe('운동');
    expect(normalizeTagLabel('ABC')).toBe('abc');
  });

  test('앞뒤 공백 제거', () => {
    expect(normalizeTagLabel('  운동  ')).toBe('운동');
  });

  test('# 접두사 제거', () => {
    expect(normalizeTagLabel('#운동')).toBe('운동');
    expect(normalizeTagLabel('##운동')).toBe('운동');
  });

  test('내부 연속 공백을 하나로', () => {
    expect(normalizeTagLabel('아침  루틴')).toBe('아침 루틴');
  });
});

describe('formatTagLabel', () => {
  test('# 접두사 추가', () => {
    expect(formatTagLabel('운동')).toBe('#운동');
  });

  test('이미 #이 있으면 중복 추가 안 함', () => {
    expect(formatTagLabel('#운동')).toBe('#운동');
  });

  test('빈 문자열이면 #만', () => {
    expect(formatTagLabel('')).toBe('#');
    expect(formatTagLabel('   ')).toBe('#');
  });
});

describe('dedupeTagLabels', () => {
  test('정규화 기준으로 중복 제거', () => {
    const result = dedupeTagLabels(['#운동', '운동', '#공부', '#운동']);
    expect(result).toEqual(['#운동', '#공부']);
  });

  test('빈 라벨 무시', () => {
    const result = dedupeTagLabels(['', '  ', '#운동']);
    expect(result).toEqual(['#운동']);
  });

  test('빈 배열 → 빈 배열', () => {
    expect(dedupeTagLabels([])).toEqual([]);
  });
});

describe('createCertificationCommand', () => {
  test('caption 앞뒤 공백 제거', () => {
    const cmd = createCertificationCommand({
      imageAsset: { uri: 'file://test.jpg', width: 100, height: 100, fileName: null, fileSize: null, mimeType: null },
      caption: '  오늘 운동 완료  ',
      personalTagLabels: [],
      groupTagLabels: ['#운동'],
    });

    expect(cmd.caption).toBe('오늘 운동 완료');
  });

  test('태그 중복 제거', () => {
    const cmd = createCertificationCommand({
      imageAsset: { uri: 'file://test.jpg', width: 100, height: 100, fileName: null, fileSize: null, mimeType: null },
      caption: 'test',
      personalTagLabels: ['#운동', '운동'],
      groupTagLabels: ['#공부', '#공부', '#운동'],
    });

    expect(cmd.personalTagLabels).toEqual(['#운동']);
    expect(cmd.groupTagLabels).toEqual(['#공부', '#운동']);
  });

  test('이미지 URI 없으면 에러', () => {
    expect(() =>
      createCertificationCommand({
        imageAsset: { uri: '', width: 100, height: 100, fileName: null, fileSize: null, mimeType: null },
        caption: 'test',
        personalTagLabels: [],
        groupTagLabels: [],
      }),
    ).toThrow('uri가 비어');
  });

  test('이미지 크기 0이면 에러', () => {
    expect(() =>
      createCertificationCommand({
        imageAsset: { uri: 'file://test.jpg', width: 0, height: 100, fileName: null, fileSize: null, mimeType: null },
        caption: 'test',
        personalTagLabels: [],
        groupTagLabels: [],
      }),
    ).toThrow('width/height');
  });
});

describe('resolveGroupShareTargets', () => {
  const directory: GroupTagDirectoryEntry[] = [
    { groupId: 'g1', groupName: '운동팟', groupTagId: 'g1:운동', label: '#운동', normalizedLabel: '운동', memberCount: 4, thresholdRule: 'N_MINUS_1' },
    { groupId: 'g1', groupName: '운동팟', groupTagId: 'g1:아침루틴', label: '#아침루틴', normalizedLabel: '아침루틴', memberCount: 4, thresholdRule: 'N_MINUS_1' },
    { groupId: 'g2', groupName: '공부방', groupTagId: 'g2:운동', label: '#운동', normalizedLabel: '운동', memberCount: 5, thresholdRule: 'ALL' },
    { groupId: 'g2', groupName: '공부방', groupTagId: 'g2:공부', label: '#공부', normalizedLabel: '공부', memberCount: 5, thresholdRule: 'ALL' },
  ];

  test('태그 하나로 여러 그룹 매칭', () => {
    const result = resolveGroupShareTargets(['운동'], directory);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.groupId).sort()).toEqual(['g1', 'g2']);
  });

  test('한 그룹에 여러 태그 매칭 → matchedGroupTagIds 복수', () => {
    const result = resolveGroupShareTargets(['운동', '아침루틴'], directory);
    const g1 = result.find((r) => r.groupId === 'g1');
    expect(g1?.matchedGroupTagIds).toHaveLength(2);
  });

  test('매칭 없으면 빈 배열', () => {
    expect(resolveGroupShareTargets(['존재안하는태그'], directory)).toEqual([]);
  });

  test('빈 태그 배열이면 빈 결과', () => {
    expect(resolveGroupShareTargets([], directory)).toEqual([]);
  });

  test('threshold 계산 포함', () => {
    const result = resolveGroupShareTargets(['운동'], directory);
    const g1 = result.find((r) => r.groupId === 'g1');
    expect(g1?.threshold).toBe(3); // N_MINUS_1, 4명
    expect(g1?.thresholdSummary).toBe('3/4명 인증');
  });

  test('결과는 그룹명 기준 정렬', () => {
    const result = resolveGroupShareTargets(['운동'], directory);
    expect(result[0].groupName).toBe('공부방');
    expect(result[1].groupName).toBe('운동팟');
  });
});

describe('resolveCertificationDraft', () => {
  const directory: GroupTagDirectoryEntry[] = [
    { groupId: 'g1', groupName: '운동팟', groupTagId: 'g1:운동', label: '#운동', normalizedLabel: '운동', memberCount: 4, thresholdRule: 'N_MINUS_1' },
  ];

  test('command + lifeDay + resolvedGroupTargets 포함', () => {
    const result = resolveCertificationDraft({
      command: {
        imageAsset: { uri: 'file://test.jpg', width: 100, height: 100, fileName: null, fileSize: null, mimeType: null },
        caption: '완료',
        personalTagLabels: [],
        groupTagLabels: ['#운동'],
      },
      createdAt: '2026-04-14T21:00:00Z', // KST 06:00
      groupTagDirectory: directory,
    });

    expect(result.command.caption).toBe('완료');
    expect(result.lifeDay.lifestyleDate).toBe('2026-04-15');
    expect(result.resolvedGroupTargets).toHaveLength(1);
    expect(result.resolvedGroupTargets[0].groupId).toBe('g1');
  });
});
