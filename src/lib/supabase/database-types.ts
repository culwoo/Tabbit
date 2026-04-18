/**
 * Supabase DB 타입 정의
 * 00001_initial_schema.sql 기반 매핑
 */

// ── Row 타입 (DB에서 읽을 때) ──

export type UserRow = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  member_limit: number;
  threshold_rule: 'ALL' | 'N_MINUS_1' | 'N_MINUS_2';
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type GroupMemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'member';
  status: 'active' | 'left';
  joined_at: string;
  left_at: string | null;
};

export type GroupTagRow = {
  id: string;
  group_id: string;
  label: string;
  normalized_label: string;
  created_at: string;
  updated_at: string;
};

export type PersonalTagRow = {
  id: string;
  user_id: string;
  label: string;
  normalized_label: string;
  created_at: string;
  updated_at: string;
};

export type CertificationRow = {
  id: string;
  user_id: string;
  image_bucket: 'certifications';
  image_path: string | null;
  image_url: string;
  image_width: number;
  image_height: number;
  caption: string;
  uploaded_at: string;
  lifestyle_date: string;
  editable_until: string;
  status: 'active' | 'deleted';
};

export type ShareTargetRow = {
  id: string;
  certification_id: string;
  kind: 'personal' | 'group_tag';
  lifestyle_date: string;
  created_at: string;
  personal_tag_ids: string[];
  group_id: string | null;
  group_tag_id: string | null;
};

export type ThresholdStateRow = {
  id: string;
  group_id: string;
  group_tag_id: string;
  lifestyle_date: string;
  eligible_member_count: number;
  effective_threshold: number;
  certified_member_count: number;
  status: 'locked' | 'provisional_unlocked' | 'finalized' | 'expired';
  unlocked_at: string | null;
  finalized_at: string | null;
};

export type StoryCardRow = {
  id: string;
  group_id: string;
  group_tag_id: string;
  lifestyle_date: string;
  status: 'locked' | 'provisional' | 'finalized' | 'revoked';
  version: number;
  unlocked_at: string | null;
  finalized_at: string | null;
  contributor_user_ids: string[];
  certification_ids: string[];
  last_snapshot_image_uri: string | null;
  last_snapshot_asset_id: string | null;
  last_snapshot_exported_by: string | null;
  last_snapshot_exported_at: string | null;
  last_snapshot_shared_at: string | null;
  last_snapshot_layout_version: string | null;
  last_snapshot_platform: 'android' | 'ios' | 'web' | 'unknown' | null;
  snapshot_export_count: number;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: 'group_invite' | 'new_certification' | 'certification_comment' | 'group_chat' | 'threshold_unlocked' | 'story_card_finalized';
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type PushTokenRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: 'android' | 'ios' | 'web' | 'unknown';
  device_id: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  disabled_at: string | null;
};

export type PushNotificationDeliveryRow = {
  id: string;
  notification_id: string;
  user_id: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  receipt_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

export type ChatMessageRow = {
  id: string;
  group_id: string;
  author_id: string;
  body: string;
  created_at: string;
};
