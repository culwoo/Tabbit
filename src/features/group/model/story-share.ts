export type ThresholdStatus = 'locked' | 'unlocked' | 'archived';

export type StoryShareCtaStyle = 'locked' | 'ready' | 'archive';

export type ThresholdState = {
  groupId: string;
  tagId: string;
  lifeDay: string;
  achievedCount: number;
  threshold: number;
  status: ThresholdStatus;
  unlockedAt?: string;
  archivedAt?: string;
};

export type StoryShareSnapshot = {
  groupId: string;
  tagId: string;
  lifeDay: string;
  exportedBy: string;
  exportedAt: string;
  layoutVersion: string;
  imagePath: string;
};

export type GroupMemberShareCard = {
  memberId: string;
  displayName: string;
  handle: string;
  accentColor: string;
  emoji: string;
  isCertified: boolean;
  caption?: string;
  completedAt?: string;
  overlayComment?: string;
};

export type GroupTagReadModel = {
  groupId: string;
  tagId: string;
  tagLabel: string;
  lifeDay: string;
  title: string;
  subtitle: string;
  thresholdState: ThresholdState;
  shareEnabled: boolean;
  shareProgressLabel: string;
  shareCtaStyle: StoryShareCtaStyle;
  shareArchiveAvailable: boolean;
  lastUpdatedAt: string;
  members: GroupMemberShareCard[];
};

export type GroupReadModel = {
  id: string;
  name: string;
  emoji: string;
  accentColor: string;
  currentLifeDay: string;
  description: string;
  currentTags: GroupTagReadModel[];
  archivedTagDays: GroupTagReadModel[];
};

export type PersonalCalendarRecord = {
  id: string;
  date: string;
  title: string;
  summary: string;
  accentColor: string;
};

export type CalendarDaySummary = {
  date: string;
  unlockedCount: number;
  snapshotCount: number;
  personalCount: number;
  label: string;
};

export type DateDetailGroupEntry = GroupTagReadModel & {
  groupName: string;
  groupEmoji: string;
  snapshot?: StoryShareSnapshot;
};

export type DateDetailModel = {
  date: string;
  groupEntries: DateDetailGroupEntry[];
  personalRecords: PersonalCalendarRecord[];
};
