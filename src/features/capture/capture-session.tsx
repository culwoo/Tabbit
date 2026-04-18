import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

import {
  acquireMedia,
  createCapturePersonalTag,
  createPersonalCaptureTagId,
  fetchCapturePersonalTags,
  fetchCaptureTagDirectory,
  getAvailableCaptureTagsFromDirectory,
  requestPermission,
  resolveShareTargets,
  submitCertification,
} from '@/features/capture/capture-service';
import type {
  CaptureDraft,
  CaptureFlowStage,
  CaptureTagOption,
  CompletedUploadSummary,
  MediaPermissionState,
  MediaSource,
  UploadErrorCode,
  UploadJobState,
  UploadProgressPhase,
} from '@/features/capture/types';
import type { GroupTagDirectoryEntry } from '@/lib/domain';
import type { PersonalTagRow } from '@/lib/supabase';
import { useAppSession } from '@/providers/app-session-provider';

type CaptureTagDirectoryStatus = 'idle' | 'loading' | 'ready' | 'failure';

type CaptureSessionState = {
  stage: CaptureFlowStage;
  draft: CaptureDraft;
  permissions: Partial<Record<MediaSource, MediaPermissionState>>;
  uploadJob: UploadJobState;
  lastCompletedUpload: CompletedUploadSummary | null;
  simulateFailureOnce: boolean;
  tagDirectory: GroupTagDirectoryEntry[];
  personalTags: PersonalTagRow[];
  tagDirectoryStatus: CaptureTagDirectoryStatus;
  tagDirectoryError: string | null;
};

type CaptureSessionValue = CaptureSessionState & {
  availableTags: CaptureTagOption[];
  reloadCaptureTags: () => Promise<void>;
  createPersonalTag: (label: string) => Promise<void>;
  openSourceSelector: () => void;
  requestAssetFromSource: (source: MediaSource, fallbackStage?: CaptureFlowStage) => Promise<void>;
  setCaption: (caption: string) => void;
  toggleTag: (tagId: string) => void;
  goToCompose: () => void;
  goToPreview: () => void;
  submitDraft: () => Promise<void>;
  discardDraft: (nextStage?: CaptureFlowStage) => void;
  cancelFlow: () => void;
  clearLastError: () => void;
  beginAnotherCapture: () => void;
  setSimulateFailureOnce: (value: boolean) => void;
};

const initialDraft: CaptureDraft = {
  asset: null,
  sourceType: null,
  caption: '',
  selectedTagIds: [],
  resolvedTargets: [],
  dirty: false,
  lastError: null,
};

const initialUploadJob: UploadJobState = {
  status: 'idle',
  progressPhase: 'idle',
  retryCount: 0,
  errorCode: null,
  errorPhase: null,
  errorDetails: null,
};

const initialState: CaptureSessionState = {
  stage: 'idle',
  draft: initialDraft,
  permissions: {},
  uploadJob: initialUploadJob,
  lastCompletedUpload: null,
  simulateFailureOnce: false,
  tagDirectory: [],
  personalTags: [],
  tagDirectoryStatus: 'idle',
  tagDirectoryError: null,
};

type CaptureSessionAction =
  | { type: 'OPEN_SOURCE_SELECTOR' }
  | { type: 'SET_STAGE'; stage: CaptureFlowStage }
  | { type: 'SET_PERMISSION'; permission: MediaPermissionState }
  | { type: 'SET_ASSET'; asset: CaptureDraft['asset']; sourceType: MediaSource }
  | { type: 'SET_CAPTION'; caption: string }
  | {
      type: 'SET_SELECTED_TAGS';
      selectedTagIds: string[];
      resolvedTargets: CaptureDraft['resolvedTargets'];
    }
  | { type: 'CLEAR_LAST_ERROR' }
  | { type: 'SET_LAST_ERROR'; message: string | null }
  | { type: 'START_UPLOAD'; retryCount: number }
  | { type: 'SET_UPLOAD_PHASE'; phase: UploadProgressPhase }
  | {
      type: 'FAIL_UPLOAD';
      message: string;
      errorCode: UploadErrorCode;
      errorPhase: UploadProgressPhase | null;
      errorDetails: string | null;
      retryCount: number;
    }
  | {
      type: 'COMPLETE_UPLOAD';
      upload: CompletedUploadSummary;
      retryCount: number;
    }
  | { type: 'RESET_FLOW'; nextStage?: CaptureFlowStage }
  | { type: 'SET_SIMULATE_FAILURE_ONCE'; value: boolean }
  | { type: 'LOAD_TAG_DIRECTORY' }
  | { type: 'SET_TAG_DIRECTORY'; directory: GroupTagDirectoryEntry[]; personalTags: PersonalTagRow[] }
  | { type: 'ADD_PERSONAL_TAG'; tag: PersonalTagRow }
  | { type: 'FAIL_TAG_DIRECTORY'; message: string }
  | { type: 'RESET_TAG_DIRECTORY' };

function isDraftDirty(draft: CaptureDraft) {
  return Boolean(
    draft.asset ||
      draft.caption.trim().length > 0 ||
      draft.selectedTagIds.length > 0 ||
      draft.resolvedTargets.length > 0 ||
      draft.lastError,
  );
}

function withDirtyDraft(draft: CaptureDraft): CaptureDraft {
  return {
    ...draft,
    dirty: isDraftDirty(draft),
  };
}

function mapPhaseToStage(phase: UploadProgressPhase): CaptureFlowStage {
  switch (phase) {
    case 'prepareUpload':
      return 'prepareUpload';
    case 'uploadMedia':
      return 'uploadMedia';
    case 'saveCertification/shareTargets':
      return 'saveCertification';
    default:
      return 'compose';
  }
}

function captureSessionReducer(
  state: CaptureSessionState,
  action: CaptureSessionAction,
): CaptureSessionState {
  switch (action.type) {
    case 'OPEN_SOURCE_SELECTOR':
      return {
        ...state,
        stage: 'sourceSelect',
      };
    case 'SET_STAGE':
      return {
        ...state,
        stage: action.stage,
      };
    case 'SET_PERMISSION':
      return {
        ...state,
        permissions: {
          ...state.permissions,
          [action.permission.source]: action.permission,
        },
      };
    case 'SET_ASSET': {
      const nextDraft = withDirtyDraft({
        ...state.draft,
        asset: action.asset,
        sourceType: action.sourceType,
        lastError: null,
      });

      return {
        ...state,
        stage: 'preview',
        draft: nextDraft,
      };
    }
    case 'SET_CAPTION': {
      const nextDraft = withDirtyDraft({
        ...state.draft,
        caption: action.caption,
      });

      return {
        ...state,
        draft: nextDraft,
      };
    }
    case 'SET_SELECTED_TAGS': {
      const nextDraft = withDirtyDraft({
        ...state.draft,
        selectedTagIds: action.selectedTagIds,
        resolvedTargets: action.resolvedTargets,
      });

      return {
        ...state,
        draft: nextDraft,
      };
    }
    case 'CLEAR_LAST_ERROR': {
      const nextDraft = withDirtyDraft({
        ...state.draft,
        lastError: null,
      });

      return {
        ...state,
        draft: nextDraft,
        uploadJob: state.uploadJob.status === 'failure' ? initialUploadJob : state.uploadJob,
      };
    }
    case 'SET_LAST_ERROR': {
      const nextDraft = withDirtyDraft({
        ...state.draft,
        lastError: action.message,
      });

      return {
        ...state,
        draft: nextDraft,
      };
    }
    case 'START_UPLOAD':
      return {
        ...state,
        stage: 'prepareUpload',
        uploadJob: {
          status: 'running',
          progressPhase: 'prepareUpload',
          retryCount: action.retryCount,
          errorCode: null,
          errorPhase: null,
          errorDetails: null,
        },
        draft: withDirtyDraft({
          ...state.draft,
          lastError: null,
        }),
      };
    case 'SET_UPLOAD_PHASE':
      return {
        ...state,
        stage: mapPhaseToStage(action.phase),
        uploadJob: {
          ...state.uploadJob,
          status: 'running',
          progressPhase: action.phase,
        },
      };
    case 'FAIL_UPLOAD':
      return {
        ...state,
        stage: 'failure',
        draft: withDirtyDraft({
          ...state.draft,
          lastError: action.message,
        }),
        uploadJob: {
          status: 'failure',
          progressPhase: state.uploadJob.progressPhase,
          retryCount: action.retryCount,
          errorCode: action.errorCode,
          errorPhase: action.errorPhase,
          errorDetails: action.errorDetails,
        },
        simulateFailureOnce: false,
      };
    case 'COMPLETE_UPLOAD':
      return {
        ...state,
        stage: 'success',
        draft: initialDraft,
        uploadJob: {
          status: 'success',
          progressPhase: 'saveCertification/shareTargets',
          retryCount: action.retryCount,
          errorCode: null,
          errorPhase: null,
          errorDetails: null,
        },
        lastCompletedUpload: action.upload,
        simulateFailureOnce: false,
      };
    case 'RESET_FLOW':
      return {
        ...state,
        stage: action.nextStage ?? 'idle',
        draft: initialDraft,
        uploadJob: initialUploadJob,
        simulateFailureOnce: false,
      };
    case 'SET_SIMULATE_FAILURE_ONCE':
      return {
        ...state,
        simulateFailureOnce: action.value,
      };
    case 'LOAD_TAG_DIRECTORY':
      return {
        ...state,
        tagDirectoryStatus: 'loading',
        tagDirectoryError: null,
      };
    case 'SET_TAG_DIRECTORY': {
      const nextResolvedTargets = resolveShareTargets(
        state.draft.selectedTagIds,
        action.directory,
      );

      return {
        ...state,
        tagDirectory: action.directory,
        personalTags: action.personalTags,
        tagDirectoryStatus: 'ready',
        tagDirectoryError: null,
        draft: withDirtyDraft({
          ...state.draft,
          resolvedTargets: nextResolvedTargets,
        }),
      };
    }
    case 'ADD_PERSONAL_TAG': {
      const existingTags = state.personalTags.filter((tag) => tag.id !== action.tag.id);
      const selectedTagId = createPersonalCaptureTagId(action.tag.id);
      const selectedTagIds = state.draft.selectedTagIds.includes(selectedTagId)
        ? state.draft.selectedTagIds
        : [...state.draft.selectedTagIds, selectedTagId];
      const nextResolvedTargets = resolveShareTargets(selectedTagIds, state.tagDirectory);

      return {
        ...state,
        personalTags: [...existingTags, action.tag].sort((left, right) =>
          left.label.localeCompare(right.label, 'ko'),
        ),
        tagDirectoryStatus: 'ready',
        tagDirectoryError: null,
        draft: withDirtyDraft({
          ...state.draft,
          selectedTagIds,
          resolvedTargets: nextResolvedTargets,
        }),
      };
    }
    case 'FAIL_TAG_DIRECTORY':
      return {
        ...state,
        tagDirectoryStatus: 'failure',
        tagDirectoryError: action.message,
      };
    case 'RESET_TAG_DIRECTORY':
      return {
        ...state,
        tagDirectory: [],
        personalTags: [],
        tagDirectoryStatus: 'idle',
        tagDirectoryError: null,
      };
    default:
      return state;
  }
}

function createInitialSelectedTags(
  selectedTagIds: string[],
  groupTagDirectory: readonly GroupTagDirectoryEntry[],
) {
  const deduped = [...new Set(selectedTagIds)];
  return {
    selectedTagIds: deduped,
    resolvedTargets: resolveShareTargets(deduped, groupTagDirectory),
  };
}

const CaptureSessionContext = createContext<CaptureSessionValue | null>(null);

export function CaptureSessionProvider({ children }: PropsWithChildren) {
  const { userId } = useAppSession();
  const [state, dispatch] = useReducer(captureSessionReducer, initialState);
  const availableTags = useMemo(
    () => getAvailableCaptureTagsFromDirectory(state.tagDirectory, state.personalTags),
    [state.tagDirectory, state.personalTags],
  );

  const reloadCaptureTags = useCallback(async () => {
    if (!userId) {
      dispatch({ type: 'RESET_TAG_DIRECTORY' });
      return;
    }

    dispatch({ type: 'LOAD_TAG_DIRECTORY' });

    try {
      const [directory, personalTags] = await Promise.all([
        fetchCaptureTagDirectory(),
        fetchCapturePersonalTags(userId),
      ]);
      dispatch({ type: 'SET_TAG_DIRECTORY', directory, personalTags });
    } catch (error) {
      dispatch({
        type: 'FAIL_TAG_DIRECTORY',
        message: normalizeCaptureSessionError(error),
      });
    }
  }, [userId]);

  const createPersonalTag = useCallback(async (label: string) => {
    if (!userId) {
      throw new Error('로그인이 필요합니다.');
    }

    const tag = await createCapturePersonalTag(userId, label);
    dispatch({ type: 'ADD_PERSONAL_TAG', tag });
  }, [userId]);

  useEffect(() => {
    void reloadCaptureTags();
  }, [reloadCaptureTags]);

  async function requestAssetFromSource(
    source: MediaSource,
    fallbackStage: CaptureFlowStage = 'sourceSelect',
  ) {
    dispatch({ type: 'SET_STAGE', stage: 'permissionCheck' });
    dispatch({ type: 'SET_LAST_ERROR', message: null });

    try {
      const permission = await requestPermission(source);
      dispatch({ type: 'SET_PERMISSION', permission });

      if (!permission.granted) {
        dispatch({
          type: 'SET_LAST_ERROR',
          message: permission.canAskAgain
            ? '권한이 아직 허용되지 않았습니다. 다시 허용을 눌러 권한 요청을 이어갈 수 있습니다.'
            : '설정에서 권한을 직접 허용해야 촬영 또는 선택을 계속할 수 있습니다.',
        });
        dispatch({ type: 'SET_STAGE', stage: fallbackStage });
        return;
      }

      dispatch({ type: 'SET_STAGE', stage: 'captureOrPick' });
      const result = await acquireMedia(source);

      if (result.status === 'cancelled') {
        dispatch({ type: 'SET_STAGE', stage: fallbackStage });
        return;
      }

      dispatch({
        type: 'SET_ASSET',
        asset: result.asset,
        sourceType: source,
      });
    } catch (error) {
      console.log('[capture] Failed to prepare media asset', error);

      dispatch({
        type: 'FAIL_UPLOAD',
        message: '사진을 준비하는 중 문제가 생겼습니다. 다시 시도해 주세요.',
        errorCode: 'UNKNOWN',
        errorPhase: 'prepareUpload',
        errorDetails: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        retryCount: state.uploadJob.retryCount,
      });
    }
  }

  async function submitDraft() {
    const nextRetryCount =
      state.uploadJob.status === 'failure' ? state.uploadJob.retryCount + 1 : state.uploadJob.retryCount;
    let currentUploadPhase: UploadProgressPhase = 'prepareUpload';

    dispatch({ type: 'START_UPLOAD', retryCount: nextRetryCount });

    try {
      const upload = await submitCertification(
        userId,
        state.draft,
        state.tagDirectory,
        state.personalTags,
        {
          simulateFailureOnce: state.simulateFailureOnce,
          onPhaseChange: (phase) => {
            currentUploadPhase = phase;
            dispatch({ type: 'SET_UPLOAD_PHASE', phase });
          },
        },
      );

      dispatch({
        type: 'COMPLETE_UPLOAD',
        upload,
        retryCount: nextRetryCount,
      });
    } catch (error) {
      const normalizedError = error as Error & {
        code?: UploadErrorCode;
        details?: string;
        phase?: UploadProgressPhase;
      };
      const errorPhase = normalizedError.phase ?? currentUploadPhase;
      const message = normalizedError.message ?? '업로드를 완료하지 못했습니다.';
      const errorCode = normalizedError.code ?? 'UNKNOWN';
      const errorDetails = normalizedError.details ?? null;

      console.log('[capture] Certification upload failed', {
        code: errorCode,
        phase: errorPhase,
        message,
        details: errorDetails,
        error,
      });

      dispatch({
        type: 'FAIL_UPLOAD',
        message,
        errorCode,
        errorPhase,
        errorDetails,
        retryCount: nextRetryCount,
      });
    }
  }

  function setCaption(caption: string) {
    dispatch({ type: 'SET_CAPTION', caption });
  }

  function toggleTag(tagId: string) {
    const selectedTagIds = state.draft.selectedTagIds.includes(tagId)
      ? state.draft.selectedTagIds.filter((selectedTagId) => selectedTagId !== tagId)
      : [...state.draft.selectedTagIds, tagId];
    const nextSelection = createInitialSelectedTags(selectedTagIds, state.tagDirectory);

    dispatch({
      type: 'SET_SELECTED_TAGS',
      selectedTagIds: nextSelection.selectedTagIds,
      resolvedTargets: nextSelection.resolvedTargets,
    });
  }

  function openSourceSelector() {
    dispatch({ type: 'OPEN_SOURCE_SELECTOR' });
  }

  function goToCompose() {
    dispatch({ type: 'SET_STAGE', stage: 'compose' });
  }

  function goToPreview() {
    dispatch({ type: 'SET_STAGE', stage: 'preview' });
  }

  function discardDraft(nextStage: CaptureFlowStage = 'idle') {
    dispatch({ type: 'RESET_FLOW', nextStage });
  }

  function cancelFlow() {
    dispatch({ type: 'RESET_FLOW', nextStage: 'cancelled' });
  }

  function clearLastError() {
    dispatch({ type: 'CLEAR_LAST_ERROR' });
  }

  function beginAnotherCapture() {
    dispatch({ type: 'RESET_FLOW', nextStage: 'sourceSelect' });
  }

  function setSimulateFailureOnce(value: boolean) {
    dispatch({ type: 'SET_SIMULATE_FAILURE_ONCE', value });
  }

  return (
    <CaptureSessionContext.Provider
      value={{
        ...state,
        availableTags,
        reloadCaptureTags,
        createPersonalTag,
        openSourceSelector,
        requestAssetFromSource,
        setCaption,
        toggleTag,
        goToCompose,
        goToPreview,
        submitDraft,
        discardDraft,
        cancelFlow,
        clearLastError,
        beginAnotherCapture,
        setSimulateFailureOnce,
      }}>
      {children}
    </CaptureSessionContext.Provider>
  );
}

export function useCaptureSession() {
  const value = useContext(CaptureSessionContext);

  if (!value) {
    throw new Error('useCaptureSession must be used within CaptureSessionProvider.');
  }

  return value;
}

function normalizeCaptureSessionError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '인증 태그 정보를 불러오지 못했습니다.';
}
