import type { CreateCertificationCommand, ResolvedGroupShareTarget } from '@/lib/domain';

export type MediaSource = 'camera' | 'library';

export type CaptureFlowStage =
  | 'idle'
  | 'sourceSelect'
  | 'permissionCheck'
  | 'captureOrPick'
  | 'preview'
  | 'compose'
  | 'prepareUpload'
  | 'uploadMedia'
  | 'saveCertification'
  | 'success'
  | 'failure'
  | 'cancelled';

export type UploadProgressPhase = 'idle' | 'prepareUpload' | 'uploadMedia' | 'saveCertification/shareTargets';

export type UploadJobStatus = 'idle' | 'running' | 'success' | 'failure';

export type UploadErrorCode =
  | 'AUTH_REQUIRED'
  | 'MISSING_ASSET'
  | 'NO_TAGS'
  | 'NO_TARGETS'
  | 'PERMISSION_DENIED'
  | 'IMAGE_PROCESSING_ERROR'
  | 'IMAGE_READ_ERROR'
  | 'STORAGE_UPLOAD_ERROR'
  | 'DATABASE_ERROR'
  | 'SUPABASE_CONFIG_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export type CaptureAsset = {
  uri: string;
  width: number;
  height: number;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  base64?: string | null;
};

export type MediaPermissionState = {
  source: MediaSource;
  granted: boolean;
  canAskAgain: boolean;
  lastCheckedAt: string;
};

export type ResolvedShareTarget = ResolvedGroupShareTarget;

export type CaptureDraft = {
  asset: CaptureAsset | null;
  sourceType: MediaSource | null;
  caption: string;
  selectedTagIds: string[];
  disabledGroupIds: string[];
  resolvedTargets: ResolvedShareTarget[];
  dirty: boolean;
  lastError: string | null;
};

export type UploadJobState = {
  status: UploadJobStatus;
  progressPhase: UploadProgressPhase;
  retryCount: number;
  errorCode: UploadErrorCode | null;
  errorPhase: UploadProgressPhase | null;
  errorDetails: string | null;
};

export type CaptureTagOption = {
  id: string;
  label: string;
  kind: 'group' | 'personal';
  connectedGroupCount: number;
  personalTagId?: string;
};

export type CompletedUploadSummary = {
  certificationId: string;
  imageUri: string;
  caption: string;
  selectedTagIds: string[];
  personalTagLabels: string[];
  groupTagLabels: string[];
  lifestyleDate: string;
  editableUntil: string;
  completedGroupCount: number;
  targets: ResolvedShareTarget[];
  createdAt: string;
  command: CreateCertificationCommand;
};

export type AcquireMediaResult =
  | { status: 'cancelled' }
  | {
      status: 'success';
      asset: CaptureAsset;
    };

export type SubmitCertificationOptions = {
  simulateFailureOnce?: boolean;
  onPhaseChange?: (phase: UploadProgressPhase) => void;
};
