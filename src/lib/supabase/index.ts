export { supabase, requireSupabase } from './client';
export type * from './database-types';

// ── CRUD modules ──
export {
  fetchMyGroups,
  fetchGroup,
  fetchGroupMembers,
  fetchGroupTags,
  fetchPersonalTags,
  syncGroupTagsToPersonalTags,
  fetchActiveGroupMemberCounts,
  createGroup,
  updateGroupThresholdRule,
  joinGroupByInviteCode,
  addGroupTag,
  deleteGroupTag,
  addPersonalTag,
  leaveGroup,
} from './groups';

export {
  uploadCertification,
  fetchCertificationsByGroupTag,
  fetchMyCertifications,
  fetchMyPersonalCertificationRecords,
  type PersonalCertificationRecord,
  deleteCertification,
  fetchShareTargets,
} from './certifications';

export {
  fetchChatMessages,
  sendChatMessage,
  subscribeToChatMessages,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  fetchUnreadNotificationCount,
} from './chat-notifications';

export {
  fetchThresholdState,
  fetchGroupThresholdStates,
  fetchStoryCard,
  fetchGroupStoryCards,
  saveStoryCardSnapshot,
  subscribeToThresholdChanges,
} from './thresholds';

export {
  registerPushToken,
  disablePushToken,
  type PushTokenPlatform,
} from './push-tokens';
