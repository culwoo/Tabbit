import { PropsWithChildren, createContext, useContext, useReducer } from 'react';

import {
  acquireMedia,
  getAvailableCaptureTags,
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

type CaptureSessionState = {
  stage: CaptureFlowStage;
  draft: CaptureDraft;
  permissions: Partial<Record<MediaSource, MediaPermissionState>>;
  uploadJob: UploadJobState;
  lastCompletedUpload: CompletedUploadSummary | null;
  simulateFailureOnce: boolean;
};

type CaptureSessionValue = CaptureSessionState & {
  availableTags: CaptureTagOption[];
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
};

const initialState: CaptureSessionState = {
  stage: 'idle',
  draft: initialDraft,
  permissions: {},
  uploadJob: initialUploadJob,
  lastCompletedUpload: null,
  simulateFailureOnce: false,
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
      retryCount: number;
    }
  | {
      type: 'COMPLETE_UPLOAD';
      upload: CompletedUploadSummary;
      retryCount: number;
    }
  | { type: 'RESET_FLOW'; nextStage?: CaptureFlowStage }
  | { type: 'SET_SIMULATE_FAILURE_ONCE'; value: boolean };

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
    default:
      return state;
  }
}

function createInitialSelectedTags(selectedTagIds: string[]) {
  const deduped = [...new Set(selectedTagIds)];
  return {
    selectedTagIds: deduped,
    resolvedTargets: resolveShareTargets(deduped),
  };
}

const CaptureSessionContext = createContext<CaptureSessionValue | null>(null);

export function CaptureSessionProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(captureSessionReducer, initialState);
  const availableTags = getAvailableCaptureTags();

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
    } catch {
      dispatch({
        type: 'FAIL_UPLOAD',
        message: '사진을 준비하는 중 문제가 생겼습니다. 다시 시도해 주세요.',
        errorCode: 'UNKNOWN',
        retryCount: state.uploadJob.retryCount,
      });
    }
  }

  async function submitDraft() {
    const nextRetryCount =
      state.uploadJob.status === 'failure' ? state.uploadJob.retryCount + 1 : state.uploadJob.retryCount;

    dispatch({ type: 'START_UPLOAD', retryCount: nextRetryCount });

    try {
      const upload = await submitCertification(state.draft, {
        simulateFailureOnce: state.simulateFailureOnce,
        onPhaseChange: (phase) => {
          dispatch({ type: 'SET_UPLOAD_PHASE', phase });
        },
      });

      dispatch({
        type: 'COMPLETE_UPLOAD',
        upload,
        retryCount: nextRetryCount,
      });
    } catch (error) {
      const normalizedError = error as Error & { code?: UploadErrorCode };

      dispatch({
        type: 'FAIL_UPLOAD',
        message: normalizedError.message ?? '업로드를 완료하지 못했습니다.',
        errorCode: normalizedError.code ?? 'UNKNOWN',
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
    const nextSelection = createInitialSelectedTags(selectedTagIds);

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
