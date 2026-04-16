import { useSyncExternalStore } from 'react';

import type {
  CalendarDaySummary,
  DateDetailGroupEntry,
  DateDetailModel,
  GroupReadModel,
  GroupTagReadModel,
  PersonalCalendarRecord,
  StoryShareSnapshot,
} from '@/features/group/model/story-share';

type StoryShareStoreState = {
  currentUserId: string;
  groups: GroupReadModel[];
  personalRecords: PersonalCalendarRecord[];
  snapshots: StoryShareSnapshot[];
};

const currentLifeDay = '2026-04-15';

const initialState: StoryShareStoreState = {
  currentUserId: 'member-minji',
  groups: [
    {
      id: 'focus-club',
      name: '새벽 운동팟',
      emoji: '🌤️',
      accentColor: '#EF8BAA',
      currentLifeDay,
      description: '출근 전에 서로 깨워주고, 태그별로 오늘의 갓생을 채우는 소규모 루틴 그룹입니다.',
      currentTags: [
        {
          groupId: 'focus-club',
          tagId: 'workout',
          tagLabel: '#운동',
          lifeDay: currentLifeDay,
          title: '팀으로 운동 루틴 채우기',
          subtitle: '임계값을 넘겼으니 지금 태그 화면을 Share Mode로 꾸며 저장하고 공유할 수 있습니다.',
          thresholdState: {
            groupId: 'focus-club',
            tagId: 'workout',
            lifeDay: currentLifeDay,
            achievedCount: 3,
            threshold: 3,
            status: 'unlocked',
            unlockedAt: '2026-04-15T04:12:00+09:00',
          },
          shareEnabled: true,
          shareProgressLabel: '인증 3/4명',
          shareCtaStyle: 'ready',
          shareArchiveAvailable: false,
          lastUpdatedAt: '2026-04-15T04:32:00+09:00',
          members: [
            {
              memberId: 'member-minji',
              displayName: '민지',
              handle: '@minji',
              accentColor: '#FFD6E6',
              emoji: '🏃',
              isCertified: true,
              caption: '출근 전 5km 러닝 완료',
              completedAt: '2026-04-15T03:41:00+09:00',
              overlayComment: '미쳤다, 페이스 좋았어',
            },
            {
              memberId: 'member-sua',
              displayName: '수아',
              handle: '@sua',
              accentColor: '#D7F0FF',
              emoji: '💪',
              isCertified: true,
              caption: '헬스장 오픈런 성공',
              completedAt: '2026-04-15T04:05:00+09:00',
              overlayComment: '폼 체크까지 완료',
            },
            {
              memberId: 'member-jiyoon',
              displayName: '지윤',
              handle: '@jiyoon',
              accentColor: '#FFF2C8',
              emoji: '🧘',
              isCertified: true,
              caption: '스트레칭 20분으로 몸 풀기',
              completedAt: '2026-04-15T04:12:00+09:00',
              overlayComment: '마지막 한 명 덕분에 언락',
            },
            {
              memberId: 'member-haneul',
              displayName: '하늘',
              handle: '@haneul',
              accentColor: '#E5DCF8',
              emoji: '🌙',
              isCertified: false,
              overlayComment: '오전 5시 전까지 추가 가능',
            },
          ],
        },
        {
          groupId: 'focus-club',
          tagId: 'study',
          tagLabel: '#공부',
          lifeDay: currentLifeDay,
          title: '집중 타임 기록',
          subtitle: '공유 버튼은 보이지만 아직 잠겨 있습니다. 오늘 안에 1명만 더 인증하면 언락됩니다.',
          thresholdState: {
            groupId: 'focus-club',
            tagId: 'study',
            lifeDay: currentLifeDay,
            achievedCount: 2,
            threshold: 3,
            status: 'locked',
          },
          shareEnabled: false,
          shareProgressLabel: '인증 2/3명',
          shareCtaStyle: 'locked',
          shareArchiveAvailable: false,
          lastUpdatedAt: '2026-04-15T01:48:00+09:00',
          members: [
            {
              memberId: 'member-minji',
              displayName: '민지',
              handle: '@minji',
              accentColor: '#FFD6E6',
              emoji: '📚',
              isCertified: true,
              caption: '모닝 페이지 30분',
              completedAt: '2026-04-15T00:22:00+09:00',
              overlayComment: '기상 직후 루틴 성공',
            },
            {
              memberId: 'member-sua',
              displayName: '수아',
              handle: '@sua',
              accentColor: '#D7F0FF',
              emoji: '📝',
              isCertified: true,
              caption: '영어 단어 2세트',
              completedAt: '2026-04-15T01:48:00+09:00',
              overlayComment: '오늘도 꾸준히',
            },
            {
              memberId: 'member-jiyoon',
              displayName: '지윤',
              handle: '@jiyoon',
              accentColor: '#FFF2C8',
              emoji: '💡',
              isCertified: false,
              overlayComment: '임계값까지 1명 남음',
            },
            {
              memberId: 'member-haneul',
              displayName: '하늘',
              handle: '@haneul',
              accentColor: '#E5DCF8',
              emoji: '☕',
              isCertified: false,
              overlayComment: '새벽 과제 인증 대기',
            },
          ],
        },
      ],
      archivedTagDays: [
        {
          groupId: 'focus-club',
          tagId: 'workout',
          tagLabel: '#운동',
          lifeDay: '2026-04-14',
          title: '어제의 운동 루틴 아카이브',
          subtitle: '오전 5시 마감 후 참여 멤버 구성을 고정한 상태입니다. 날짜 상세에서 다시 Share Mode로 열 수 있습니다.',
          thresholdState: {
            groupId: 'focus-club',
            tagId: 'workout',
            lifeDay: '2026-04-14',
            achievedCount: 4,
            threshold: 3,
            status: 'archived',
            unlockedAt: '2026-04-15T00:11:00+09:00',
            archivedAt: '2026-04-15T05:00:00+09:00',
          },
          shareEnabled: true,
          shareProgressLabel: '인증 4/4명',
          shareCtaStyle: 'archive',
          shareArchiveAvailable: true,
          lastUpdatedAt: '2026-04-15T05:00:00+09:00',
          members: [
            {
              memberId: 'member-minji',
              displayName: '민지',
              handle: '@minji',
              accentColor: '#FFD6E6',
              emoji: '🏃',
              isCertified: true,
              caption: '천변 러닝 완료',
              completedAt: '2026-04-14T22:21:00+09:00',
              overlayComment: '하루 마무리 러닝',
            },
            {
              memberId: 'member-sua',
              displayName: '수아',
              handle: '@sua',
              accentColor: '#D7F0FF',
              emoji: '💪',
              isCertified: true,
              caption: '하체 루틴 클리어',
              completedAt: '2026-04-14T23:40:00+09:00',
              overlayComment: '사진 톤이 제일 예뻤던 날',
            },
            {
              memberId: 'member-jiyoon',
              displayName: '지윤',
              handle: '@jiyoon',
              accentColor: '#FFF2C8',
              emoji: '🧘',
              isCertified: true,
              caption: '요가로 마감',
              completedAt: '2026-04-15T00:05:00+09:00',
              overlayComment: '임계값 직전 합류',
            },
            {
              memberId: 'member-haneul',
              displayName: '하늘',
              handle: '@haneul',
              accentColor: '#E5DCF8',
              emoji: '🚴',
              isCertified: true,
              caption: '실내 자전거 15분',
              completedAt: '2026-04-15T00:11:00+09:00',
              overlayComment: '마감 직전 완전체',
            },
          ],
        },
      ],
    },
  ],
  personalRecords: [
    {
      id: 'personal-2026-04-15-journal',
      date: '2026-04-15',
      title: '개인공간 회고',
      summary: '운동 인증 후 오늘 컨디션을 짧게 남겼습니다.',
      accentColor: '#DDEAFE',
    },
    {
      id: 'personal-2026-04-14-gratitude',
      date: '2026-04-14',
      title: '감사 일기',
      summary: '어제 루틴을 끝낸 뒤 자기 전 회고를 남겼습니다.',
      accentColor: '#FFF0D9',
    },
  ],
  snapshots: [
    {
      groupId: 'focus-club',
      tagId: 'workout',
      lifeDay: '2026-04-14',
      exportedBy: 'member-minji',
      exportedAt: '2026-04-15T00:28:00+09:00',
      layoutVersion: 'share-mode-v1',
      imagePath: 'file://snapshots/focus-club-workout-2026-04-14.png',
    },
  ],
};

let storeState = initialState;

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return storeState;
}

export function useStoryShareStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function saveStoryShareSnapshot(snapshot: StoryShareSnapshot) {
  const snapshotKey = `${snapshot.groupId}:${snapshot.tagId}:${snapshot.lifeDay}`;
  const nextSnapshots = storeState.snapshots.filter(
    (item) => `${item.groupId}:${item.tagId}:${item.lifeDay}` !== snapshotKey,
  );

  storeState = {
    ...storeState,
    snapshots: [snapshot, ...nextSnapshots],
  };

  emitChange();
}

export function selectGroupById(state: StoryShareStoreState, groupId: string) {
  return state.groups.find((group) => group.id === groupId);
}

export function selectSnapshot(
  state: StoryShareStoreState,
  groupId: string,
  tagId: string,
  lifeDay: string,
) {
  return state.snapshots.find(
    (snapshot) =>
      snapshot.groupId === groupId && snapshot.tagId === tagId && snapshot.lifeDay === lifeDay,
  );
}

export function selectCalendarSummaries(state: StoryShareStoreState): CalendarDaySummary[] {
  const summaryMap = new Map<string, CalendarDaySummary>();

  function ensureSummary(date: string) {
    if (!summaryMap.has(date)) {
      summaryMap.set(date, {
        date,
        unlockedCount: 0,
        snapshotCount: 0,
        personalCount: 0,
        label: '',
      });
    }

    return summaryMap.get(date)!;
  }

  state.groups.forEach((group) => {
    [...group.currentTags, ...group.archivedTagDays].forEach((entry) => {
      const summary = ensureSummary(entry.lifeDay);
      if (entry.thresholdState.status !== 'locked') {
        summary.unlockedCount += 1;
      }
    });
  });

  state.personalRecords.forEach((record) => {
    const summary = ensureSummary(record.date);
    summary.personalCount += 1;
  });

  state.snapshots.forEach((snapshot) => {
    const summary = ensureSummary(snapshot.lifeDay);
    summary.snapshotCount += 1;
  });

  summaryMap.forEach((summary) => {
    const pieces = [];
    if (summary.unlockedCount > 0) {
      pieces.push(`언락 ${summary.unlockedCount}`);
    }
    if (summary.snapshotCount > 0) {
      pieces.push(`스냅샷 ${summary.snapshotCount}`);
    }
    if (summary.personalCount > 0) {
      pieces.push(`개인 ${summary.personalCount}`);
    }
    summary.label = pieces.join(' · ');
  });

  return [...summaryMap.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function selectDateDetail(state: StoryShareStoreState, date: string): DateDetailModel {
  const groupEntries: DateDetailGroupEntry[] = [];

  state.groups.forEach((group) => {
    [...group.currentTags, ...group.archivedTagDays]
      .filter((entry) => entry.lifeDay === date)
      .forEach((entry) => {
        groupEntries.push({
          ...entry,
          groupName: group.name,
          groupEmoji: group.emoji,
          snapshot: selectSnapshot(state, entry.groupId, entry.tagId, entry.lifeDay),
        });
      });
  });

  return {
    date,
    groupEntries: groupEntries.sort((a, b) => a.tagLabel.localeCompare(b.tagLabel)),
    personalRecords: state.personalRecords.filter((record) => record.date === date),
  };
}

export function selectTagEntriesForGroup(
  state: StoryShareStoreState,
  groupId: string,
  lifeDay?: string,
) {
  const group = selectGroupById(state, groupId);
  if (!group) {
    return [] as GroupTagReadModel[];
  }

  if (!lifeDay || lifeDay === group.currentLifeDay) {
    return group.currentTags;
  }

  return group.archivedTagDays.filter((entry) => entry.lifeDay === lifeDay);
}

export function getCurrentUserId() {
  return storeState.currentUserId;
}
