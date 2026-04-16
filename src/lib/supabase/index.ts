export { supabase, requireSupabase } from './client';
export type * from './database-types';

// ── CRUD modules ──
export {
  fetchMyGroups,
  fetchGroup,
  fetchGroupMembers,
  fetchGroupTags,
  createGroup,
  joinGroupByInviteCode,
  addGroupTag,
  leaveGroup,
} from './groups';

export {
  uploadCertification,
  fetchCertificationsByGroupTag,
  fetchMyCertifications,
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
  subscribeToThresholdChanges,
} from './thresholds';
