export const APP_TIME_ZONE = 'Asia/Seoul' as const;
export const LIFE_DAY_CUTOFF_HOUR_KST = 5 as const;

export type ThresholdRule = 'ALL' | 'N_MINUS_1' | 'N_MINUS_2';
export type GroupMemberRole = 'owner' | 'member';
export type GroupMemberStatus = 'active' | 'left';
export type CertificationStatus = 'active' | 'deleted';
export type ShareTargetKind = 'personal' | 'group_tag';
export type ThresholdStateStatus = 'locked' | 'provisional_unlocked' | 'finalized' | 'expired';
export type StoryCardStatus = 'locked' | 'provisional' | 'finalized' | 'revoked';
export type NotificationType =
  | 'group_invite'
  | 'new_certification'
  | 'certification_comment'
  | 'group_chat'
  | 'threshold_unlocked'
  | 'story_card_finalized';

export type ImageAssetInput = {
  uri: string;
  width: number;
  height: number;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
};

export type User = {
  id: string;
  displayName: string;
  handle?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersonalTag = {
  id: string;
  userId: string;
  label: string;
  normalizedLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type Group = {
  id: string;
  name: string;
  description?: string | null;
  memberLimit: 12;
  thresholdRule: ThresholdRule;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type GroupMember = {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  joinedAt: string;
  leftAt?: string | null;
};

export type GroupTag = {
  id: string;
  groupId: string;
  label: string;
  normalizedLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type Certification = {
  id: string;
  userId: string;
  imageAsset: ImageAssetInput;
  caption: string;
  uploadedAt: string;
  lifestyleDate: string;
  editableUntil: string;
  status: CertificationStatus;
};

export type ShareTarget = {
  id: string;
  certificationId: string;
  kind: ShareTargetKind;
  lifestyleDate: string;
  createdAt: string;
  personalTagIds?: string[];
  groupId?: string | null;
  groupTagId?: string | null;
};

export type CertificationComment = {
  id: string;
  certificationId: string;
  authorId: string;
  body: string;
  xRatio: number;
  yRatio: number;
  textColor: 'black' | 'white';
  createdAt: string;
  updatedAt: string;
};

export type ThresholdState = {
  id: string;
  groupId: string;
  groupTagId: string;
  lifestyleDate: string;
  eligibleMemberCount: number;
  effectiveThreshold: number;
  certifiedMemberCount: number;
  status: ThresholdStateStatus;
  unlockedAt?: string | null;
  finalizedAt?: string | null;
};

export type StoryCard = {
  id: string;
  groupId: string;
  groupTagId: string;
  lifestyleDate: string;
  status: StoryCardStatus;
  version: number;
  unlockedAt?: string | null;
  finalizedAt?: string | null;
  contributorUserIds: string[];
  certificationIds: string[];
  updatedAt: string;
};

export type NotificationEntity = {
  id: string;
  userId: string;
  type: NotificationType;
  readAt?: string | null;
  createdAt: string;
  payload: Record<string, string | number | boolean | null>;
};

export type ChatMessage = {
  id: string;
  groupId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type CreateCertificationCommand = {
  imageAsset: ImageAssetInput;
  caption: string;
  personalTagLabels: string[];
  groupTagLabels: string[];
};

export type LifeDayMetadata = {
  lifestyleDate: string;
  editableUntil: string;
  timeZone: typeof APP_TIME_ZONE;
};

export type GroupTagDirectoryEntry = {
  groupId: string;
  groupName: string;
  groupTagId: string;
  label: string;
  normalizedLabel: string;
  memberCount: number;
  thresholdRule: ThresholdRule;
};

export type ResolvedGroupShareTarget = {
  groupId: string;
  groupName: string;
  matchedGroupTagIds: string[];
  matchedGroupTagLabels: string[];
  memberCount: number;
  thresholdRule: ThresholdRule;
  threshold: number;
  thresholdSummary: string;
};

export type CertificationDraftResolution = {
  command: CreateCertificationCommand;
  lifeDay: LifeDayMetadata;
  resolvedGroupTargets: ResolvedGroupShareTarget[];
};

export type ThresholdComputation = {
  eligibleMemberCount: number;
  effectiveThreshold: number;
  certifiedMemberCount: number;
  meetsThreshold: boolean;
  thresholdStateStatus: ThresholdStateStatus;
  storyCardStatus: StoryCardStatus;
};
