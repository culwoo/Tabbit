import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { router, useLocalSearchParams, useNavigation, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PhotoBlock,
  Tape,
  paperColors,
  paperFonts,
  paperShadow,
  stripHash,
  type PaperTone,
} from '@/components/ui/paper-design';
import { useCaptureSession } from '@/features/capture/capture-session';
import type { CaptureTagOption, MediaSource, UploadProgressPhase } from '@/features/capture/types';
import { resolveLifestyleDate } from '@/lib/domain';
import { formatTimestampLabel } from '@/lib/life-day';
import { useFontPreference } from '@/providers/font-preference-provider';

const sourceLabels: Record<MediaSource, string> = {
  camera: '카메라',
  library: '갤러리',
};

const uploadPhaseLabels: Record<UploadProgressPhase, string> = {
  idle: '대기',
  prepareUpload: '이미지 준비',
  uploadMedia: '사진 업로드',
  'saveCertification/shareTargets': '인증 저장',
};

const TAG_TONES: Record<string, PaperTone> = {
  '1만원데이': 'sky',
  공부: 'peach',
  기상: 'butter',
  독서: 'peach',
  명상: 'lilac',
  무지출: 'sky',
  미라클모닝: 'butter',
  식단: 'sage',
  음악: 'lilac',
  운동: 'sage',
  헬스: 'sage',
};

function formatUploadPhaseLabel(phase: UploadProgressPhase | null) {
  return phase ? uploadPhaseLabels[phase] : null;
}

function formatShortDate() {
  const [, month, day] = resolveLifestyleDate(new Date()).split('-');
  return `오늘 · ${Number(month)}.${Number(day)}`;
}

function toneForTag(label?: string, index = 0): PaperTone {
  const clean = stripHash(label ?? '');
  return TAG_TONES[clean] ?? (['sage', 'peach', 'sky', 'butter', 'lilac'] as PaperTone[])[index % 5];
}

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tag?: string }>();
  const {
    stage,
    draft,
    permissions,
    uploadJob,
    availableTags,
    tagDirectoryStatus,
    tagDirectoryError,
    lastCompletedUpload,
    reloadCaptureTags,
    createPersonalTag,
    openSourceSelector,
    requestAssetFromSource,
    setCapturedAsset,
    setCaption,
    toggleTag,
    toggleShareTarget,
    goToCompose,
    goToPreview,
    submitDraft,
    discardDraft,
    cancelFlow,
    clearLastError,
    beginAnotherCapture,
  } = useCaptureSession();

  const [newPersonalTagLabel, setNewPersonalTagLabel] = useState('');
  const [isCreatingPersonalTag, setCreatingPersonalTag] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [isTakingPicture, setTakingPicture] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const appliedInitialTagRef = useRef<string | null>(null);

  const isBusyPreparing = stage === 'permissionCheck' || stage === 'captureOrPick';
  const isUploading = uploadJob.status === 'running';
  const canSubmit =
    Boolean(draft.asset) &&
    draft.selectedTagIds.length > 0 &&
    tagDirectoryStatus === 'ready' &&
    !isUploading;
  const deniedPermissions = (Object.values(permissions) ?? []).filter((permission) => !permission?.granted);
  const isShareRoute = pathname === '/capture/share';
  const selectedTags = useMemo(
    () => availableTags.filter((tag) => draft.selectedTagIds.includes(tag.id)),
    [availableTags, draft.selectedTagIds],
  );
  const selectedPersonalTagCount = selectedTags.filter((tag) => tag.kind === 'personal').length;
  const activeTargets = draft.resolvedTargets.filter(
    (target) => !draft.disabledGroupIds.includes(target.groupId),
  );
  const requestedTagLabel = Array.isArray(params.tag) ? params.tag[0] : params.tag;

  const confirmDiscardDraft = useCallback(() => {
    Alert.alert('초안을 버릴까요?', '선택한 사진, 문구, 태그가 사라집니다.', [
      {
        style: 'cancel',
        text: '계속 편집',
      },
      {
        onPress: () => {
          cancelFlow();
        },
        style: 'destructive',
        text: '버리고 나가기',
      },
    ]);
  }, [cancelFlow]);

  useEffect(() => {
    if (isFocused && stage === 'idle') {
      openSourceSelector();
    }
  }, [isFocused, openSourceSelector, stage]);

  useEffect(() => {
    if (!isFocused || stage !== 'sourceSelect') {
      return;
    }

    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      void requestCameraPermission();
    }
  }, [cameraPermission, isFocused, requestCameraPermission, stage]);

  useEffect(() => {
    if (isFocused) {
      void reloadCaptureTags();
    }
  }, [isFocused, reloadCaptureTags]);

  useEffect(() => {
    const normalizedRequestedTag = stripHash(requestedTagLabel ?? '').toLocaleLowerCase('ko-KR');

    if (
      !isFocused ||
      !normalizedRequestedTag ||
      tagDirectoryStatus !== 'ready' ||
      draft.selectedTagIds.length > 0 ||
      appliedInitialTagRef.current === normalizedRequestedTag
    ) {
      return;
    }

    const matchingTag = availableTags.find(
      (tag) =>
        tag.id === normalizedRequestedTag ||
        stripHash(tag.label).toLocaleLowerCase('ko-KR') === normalizedRequestedTag,
    );

    if (!matchingTag) {
      return;
    }

    appliedInitialTagRef.current = normalizedRequestedTag;
    toggleTag(matchingTag.id);
  }, [availableTags, draft.selectedTagIds.length, isFocused, requestedTagLabel, tagDirectoryStatus, toggleTag]);

  useEffect(() => {
    if (!isFocused || stage !== 'cancelled') {
      return;
    }

    router.replace('/');
    discardDraft('idle');
  }, [discardDraft, isFocused, stage]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isUploading) {
        return true;
      }

      if (stage === 'sourceSelect') {
        cancelFlow();
        return true;
      }

      if (stage === 'preview' || stage === 'compose' || stage === 'failure') {
        confirmDiscardDraft();
        return true;
      }

      if (stage === 'success') {
        discardDraft('idle');
        router.replace('/');
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [cancelFlow, confirmDiscardDraft, discardDraft, isFocused, isUploading, navigation, stage]);

  function handleSourcePress(source: MediaSource) {
    void requestAssetFromSource(source);
  }

  async function handleLiveCapture() {
    if (isTakingPicture) {
      return;
    }

    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        return;
      }
    }

    if (!cameraRef.current || !cameraReady) {
      return;
    }

    setTakingPicture(true);

    try {
      const picture: CameraCapturedPicture = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 1,
        skipProcessing: false,
      });

      setCapturedAsset(
        {
          base64: picture.base64 ?? null,
          fileName: null,
          fileSize: null,
          height: picture.height,
          mimeType: picture.format === 'png' ? 'image/png' : 'image/jpeg',
          uri: picture.uri,
          width: picture.width,
        },
        'camera',
      );
    } catch (error) {
      Alert.alert(
        '촬영 실패',
        error instanceof Error ? error.message : '사진을 찍지 못했습니다. 다시 시도해주세요.',
      );
    } finally {
      setTakingPicture(false);
    }
  }

  function handleReplaceAsset(source: MediaSource) {
    void requestAssetFromSource(source, 'preview');
  }

  function handleSubmit() {
    clearLastError();
    void submitDraft();
  }

  async function handleCreatePersonalTag() {
    const label = newPersonalTagLabel.trim();

    if (!label || isCreatingPersonalTag || isUploading) {
      return;
    }

    setCreatingPersonalTag(true);

    try {
      await createPersonalTag(label);
      setNewPersonalTagLabel('');
      setShowNewTag(false);
    } catch (error) {
      Alert.alert(
        '태그 생성 실패',
        error instanceof Error ? error.message : '개인 태그를 만들지 못했습니다.',
      );
    } finally {
      setCreatingPersonalTag(false);
    }
  }

  function handleResumeEditing() {
    clearLastError();
    goToCompose();

    if (!isShareRoute) {
      router.push('/capture/share');
    }
  }

  function handleHeaderClose() {
    if (isUploading) {
      return;
    }

    if (stage === 'preview' || stage === 'compose' || stage === 'failure') {
      confirmDiscardDraft();
      return;
    }

    if (stage === 'success') {
      discardDraft('idle');
      router.replace('/');
      return;
    }

    cancelFlow();
  }

  function handleContinueToShare() {
    goToCompose();

    if (!isShareRoute) {
      router.push('/capture/share');
    }
  }

  function handleReturnToTags() {
    goToPreview();

    if (isShareRoute) {
      if (navigation.canGoBack()) {
        router.back();
      } else {
        router.replace('/capture');
      }
    }
  }

  function handleBackToCapture() {
    discardDraft('sourceSelect');

    if (isShareRoute) {
      router.replace('/capture');
    }
  }

  function openAppSettings() {
    void Linking.openSettings();
  }

  if (stage === 'success') {
    return (
      <SuccessScreen
        bottomInset={insets.bottom}
        lastCompletedUpload={lastCompletedUpload}
        onAnother={beginAnotherCapture}
        onClose={handleHeaderClose}
        topInset={insets.top}
      />
    );
  }

  if (stage === 'preview' && draft.asset) {
    return (
      <TagSelectScreen
        activeTargets={activeTargets}
        availableTags={availableTags}
        bottomInset={insets.bottom}
        deniedPermissions={deniedPermissions}
        draft={draft}
        isBusyPreparing={isBusyPreparing}
        isCreatingPersonalTag={isCreatingPersonalTag}
        isUploading={isUploading}
        newPersonalTagLabel={newPersonalTagLabel}
        onBack={handleBackToCapture}
        onCreatePersonalTag={() => void handleCreatePersonalTag()}
        onNext={handleContinueToShare}
        onOpenSettings={openAppSettings}
        onReloadTags={() => void reloadCaptureTags()}
        onReplaceAsset={handleReplaceAsset}
        onSetNewPersonalTagLabel={setNewPersonalTagLabel}
        onShowNewTag={setShowNewTag}
        onToggleShareTarget={toggleShareTarget}
        onToggleTag={toggleTag}
        selectedPersonalTagCount={selectedPersonalTagCount}
        selectedTags={selectedTags}
        showNewTag={showNewTag}
        tagDirectoryError={tagDirectoryError}
        tagDirectoryStatus={tagDirectoryStatus}
        topInset={insets.top}
      />
    );
  }

  if (
    (stage === 'compose' ||
      stage === 'prepareUpload' ||
      stage === 'uploadMedia' ||
      stage === 'saveCertification' ||
      stage === 'failure') &&
    draft.asset
  ) {
    return (
      <CaptionScreen
        activeTargets={activeTargets}
        bottomInset={insets.bottom}
        canSubmit={canSubmit}
        draft={draft}
        isUploading={isUploading}
        onBack={handleReturnToTags}
        onCancel={confirmDiscardDraft}
        onResumeEditing={handleResumeEditing}
        onSetCaption={setCaption}
        onSubmit={handleSubmit}
        selectedTags={selectedTags}
        stage={stage}
        topInset={insets.top}
        uploadJob={uploadJob}
      />
    );
  }

  return (
    <SourceSelectScreen
      bottomInset={insets.bottom}
      cameraPermission={cameraPermission}
      cameraReady={cameraReady}
      cameraRef={cameraRef}
      deniedPermissions={deniedPermissions}
      isBusyPreparing={isBusyPreparing || isTakingPicture}
      onCancel={handleHeaderClose}
      onCameraReady={() => setCameraReady(true)}
      onOpenSettings={openAppSettings}
      onPickGallery={() => handleSourcePress('library')}
      onRequestCameraPermission={() => void requestCameraPermission()}
      onRetryPermission={(source) => handleSourcePress(source)}
      onShoot={() => void handleLiveCapture()}
      stage={stage}
      topInset={insets.top}
    />
  );
}

type PaperButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'coral' | 'dark' | 'light';
};

function PaperButton({ disabled = false, label, onPress, tone = 'dark' }: PaperButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.paperButton,
        tone === 'coral' ? styles.paperButtonCoral : undefined,
        tone === 'light' ? styles.paperButtonLight : undefined,
        disabled ? styles.disabledButton : undefined,
      ]}>
      <Text style={[styles.paperButtonText, tone === 'light' ? styles.paperButtonTextDark : undefined]}>
        {label}
      </Text>
    </Pressable>
  );
}

type SourceSelectScreenProps = {
  bottomInset: number;
  cameraPermission: ReturnType<typeof useCameraPermissions>[0];
  cameraReady: boolean;
  cameraRef: RefObject<CameraView | null>;
  deniedPermissions: { canAskAgain: boolean; granted: boolean; source: MediaSource }[];
  isBusyPreparing: boolean;
  onCancel: () => void;
  onCameraReady: () => void;
  onOpenSettings: () => void;
  onPickGallery: () => void;
  onRequestCameraPermission: () => void;
  onRetryPermission: (source: MediaSource) => void;
  onShoot: () => void;
  stage: string;
  topInset: number;
};

function SourceSelectScreen({
  bottomInset,
  cameraPermission,
  cameraReady,
  cameraRef,
  deniedPermissions,
  isBusyPreparing,
  onCancel,
  onCameraReady,
  onOpenSettings,
  onPickGallery,
  onRequestCameraPermission,
  onRetryPermission,
  onShoot,
  stage,
  topInset,
}: SourceSelectScreenProps) {
  return (
    <View style={styles.captureScreen}>
      <View style={[styles.captureTopBar, { paddingTop: topInset + 4 }]}>
        <Pressable accessibilityLabel="닫기" onPress={onCancel} style={styles.closeIconButton}>
          <Ionicons color={paperColors.ink0} name="close" size={23} />
        </Pressable>
        <Text style={styles.captureTitle}>오늘의 한 컷</Text>
        <View style={styles.topPlaceholder} />
      </View>

      <View style={styles.viewfinderCenter}>
        <View style={styles.viewfinderPolaroid}>
          <Tape angle={-8} left={96} top={-12} width={70} />
          <View style={styles.viewfinderSquare}>
            {cameraPermission?.granted ? (
              <CameraView
                active
                animateShutter={false}
                facing="back"
                mode="picture"
                onCameraReady={onCameraReady}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Pressable onPress={onRequestCameraPermission} style={styles.cameraPermissionPrompt}>
                <Ionicons color={paperColors.card} name="camera-outline" size={38} />
                <Text style={styles.cameraPermissionTitle}>카메라 켜기</Text>
                <Text style={styles.cameraPermissionText}>
                  허용하면 이 프레임 안에서 바로 확인할 수 있어요
                </Text>
              </Pressable>
            )}
            <View style={styles.scanLines} />
            <View style={styles.focusBox}>
              <View style={[styles.focusCorner, styles.focusCornerTopLeft]} />
              <View style={[styles.focusCorner, styles.focusCornerTopRight]} />
              <View style={[styles.focusCorner, styles.focusCornerBottomLeft]} />
              <View style={[styles.focusCorner, styles.focusCornerBottomRight]} />
            </View>
            {isBusyPreparing || (cameraPermission?.granted && !cameraReady) ? (
              <View style={styles.viewfinderBusy}>
                <ActivityIndicator color={paperColors.card} />
                <Text style={styles.viewfinderBusyText}>
                  {stage === 'permissionCheck'
                    ? '권한 확인 중'
                    : cameraPermission?.granted && !cameraReady
                      ? '카메라 켜는 중'
                      : '사진을 준비하는 중'}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.viewfinderCaption}>{formatShortDate()}</Text>
        </View>
      </View>

      {deniedPermissions.length > 0 ? (
        <View style={styles.permissionNotes}>
          {deniedPermissions.map((permission) => (
            <View key={permission.source} style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>
                {sourceLabels[permission.source]} 권한이 필요해요
              </Text>
              <Text style={styles.permissionText}>
                {permission.canAskAgain
                  ? '다시 허용을 누르면 권한 요청을 이어갈 수 있어요.'
                  : '설정에서 권한을 직접 허용해야 계속할 수 있어요.'}
              </Text>
              <View style={styles.permissionActions}>
                {permission.canAskAgain ? (
                  <PaperButton
                    label="다시 허용"
                    onPress={() => onRetryPermission(permission.source)}
                    tone="light"
                  />
                ) : null}
                <PaperButton label="설정으로" onPress={onOpenSettings} tone="light" />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.captureControls, { paddingBottom: bottomInset + 28 }]}>
        <Pressable
          accessibilityLabel="갤러리에서 선택"
          disabled={isBusyPreparing}
          onPress={onPickGallery}
          style={[styles.galleryButton, isBusyPreparing ? styles.disabledButton : undefined]}>
          <View style={styles.galleryThumb}>
            <View style={styles.galleryThumbInner} />
          </View>
          <Text style={styles.controlLabel}>갤러리</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="사진 촬영"
          disabled={isBusyPreparing}
          onPress={onShoot}
          style={[styles.shutterButton, isBusyPreparing ? styles.disabledButton : undefined]}>
          <View style={styles.shutterInner}>
            <Ionicons color={paperColors.ink0} name="camera" size={28} />
          </View>
        </Pressable>

        <View style={styles.controlSpacer} />
      </View>
    </View>
  );
}

type TagSelectScreenProps = {
  activeTargets: { groupId: string }[];
  availableTags: CaptureTagOption[];
  bottomInset: number;
  deniedPermissions: { canAskAgain: boolean; granted: boolean; source: MediaSource }[];
  draft: ReturnType<typeof useCaptureSession>['draft'];
  isBusyPreparing: boolean;
  isCreatingPersonalTag: boolean;
  isUploading: boolean;
  newPersonalTagLabel: string;
  onBack: () => void;
  onCreatePersonalTag: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
  onReloadTags: () => void;
  onReplaceAsset: (source: MediaSource) => void;
  onSetNewPersonalTagLabel: (value: string) => void;
  onShowNewTag: (value: boolean) => void;
  onToggleShareTarget: (groupId: string) => void;
  onToggleTag: (tagId: string) => void;
  selectedPersonalTagCount: number;
  selectedTags: CaptureTagOption[];
  showNewTag: boolean;
  tagDirectoryError: string | null;
  tagDirectoryStatus: string;
  topInset: number;
};

function TagSelectScreen({
  activeTargets,
  availableTags,
  bottomInset,
  deniedPermissions,
  draft,
  isBusyPreparing,
  isCreatingPersonalTag,
  isUploading,
  newPersonalTagLabel,
  onBack,
  onCreatePersonalTag,
  onNext,
  onOpenSettings,
  onReloadTags,
  onReplaceAsset,
  onSetNewPersonalTagLabel,
  onShowNewTag,
  onToggleShareTarget,
  onToggleTag,
  selectedPersonalTagCount,
  selectedTags,
  showNewTag,
  tagDirectoryError,
  tagDirectoryStatus,
  topInset,
}: TagSelectScreenProps) {
  const { bodyTextStyle, strongTextStyle } = useFontPreference();
  const canGoNext = draft.selectedTagIds.length > 0 && tagDirectoryStatus === 'ready';
  const privateOnly = draft.resolvedTargets.length === 0 && draft.selectedTagIds.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.paperScreen}>
      <View style={[styles.stepTopBar, { paddingTop: topInset + 4 }]}>
        <Pressable accessibilityLabel="촬영 화면으로 돌아가기" onPress={onBack} style={styles.stepBackButton}>
          <Ionicons color={paperColors.ink0} name="chevron-back" size={22} />
        </Pressable>
        <Text style={[styles.stepTitle, strongTextStyle]}>어떤 태그야?</Text>
        <Pressable
          accessibilityLabel="다른 사진 선택"
          disabled={isBusyPreparing}
          onPress={() => onReplaceAsset('library')}
          style={styles.replaceButton}>
          <Text style={[styles.replaceButtonText, bodyTextStyle]}>바꾸기</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.tagScrollContent, { paddingBottom: bottomInset + 132 }]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.previewPolaroidWrap}>
          <View style={styles.previewPolaroid}>
            <Tape angle={-8} left={52} top={-10} width={50} />
            <PhotoBlock
              height={118}
              label=""
              tone={toneForTag(selectedTags[0]?.label)}
              uri={draft.asset?.uri}
              width={118}
            />
          </View>
        </View>

        <View style={styles.tagHeaderRow}>
          <Text style={[styles.sectionEyebrow, bodyTextStyle]}>내 태그 · {draft.selectedTagIds.length}개 선택</Text>
          <Pressable onPress={() => onShowNewTag(true)} style={styles.newTagButton}>
            <Text style={[styles.newTagButtonText, strongTextStyle]}>+ 새 태그</Text>
          </Pressable>
        </View>

        {showNewTag ? (
          <View style={styles.newTagRow}>
            <TextInput
              autoFocus
              editable={!isUploading && !isCreatingPersonalTag}
              maxLength={24}
              onChangeText={onSetNewPersonalTagLabel}
              onSubmitEditing={onCreatePersonalTag}
              placeholder="새 태그 이름 (예: 독서)"
              placeholderTextColor={paperColors.ink3}
              style={[styles.newTagInput, strongTextStyle]}
              value={newPersonalTagLabel}
            />
            <Pressable
              disabled={!newPersonalTagLabel.trim() || isCreatingPersonalTag || isUploading}
              onPress={onCreatePersonalTag}
              style={[
                styles.newTagCreateButton,
                (!newPersonalTagLabel.trim() || isCreatingPersonalTag || isUploading) && styles.disabledButton,
              ]}>
              <Text style={[styles.newTagCreateText, strongTextStyle]}>
                {isCreatingPersonalTag ? '만드는 중' : '만들기'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.tagChipWrap}>
          {tagDirectoryStatus === 'loading' ? (
            <View style={styles.inlineStatus}>
              <ActivityIndicator color={paperColors.coral} />
              <Text style={[styles.inlineStatusText, bodyTextStyle]}>그룹 태그를 불러오는 중</Text>
            </View>
          ) : null}

          {tagDirectoryStatus === 'failure' ? (
            <View style={styles.directoryErrorCard}>
              <Text selectable style={[styles.directoryErrorText, bodyTextStyle]}>
                {tagDirectoryError ?? '태그 정보를 불러오지 못했습니다.'}
              </Text>
              <PaperButton label="다시 불러오기" onPress={onReloadTags} tone="light" />
            </View>
          ) : null}

          {tagDirectoryStatus === 'ready' && availableTags.length === 0 ? (
            <Text style={[styles.emptyTagText, bodyTextStyle]}>
              아직 선택할 태그가 없어요. 새 태그를 만들면 개인공간에 저장할 수 있어요.
            </Text>
          ) : null}

          {availableTags.map((tag, index) => {
            const active = draft.selectedTagIds.includes(tag.id);
            const tone = toneForTag(tag.label, index);
            const isPrivate = tag.kind === 'personal';

            return (
              <Pressable
                disabled={isUploading}
                key={tag.id}
                onPress={() => onToggleTag(tag.id)}
                style={[
                  styles.tagChip,
                  active
                    ? { backgroundColor: paperColors[tone], borderColor: paperColors.ink0 }
                    : isPrivate
                      ? styles.tagChipPrivate
                      : undefined,
                  active ? styles.tagChipActive : undefined,
                  isUploading ? styles.disabledButton : undefined,
                ]}>
                <Text style={[styles.tagChipLabel, strongTextStyle]}>#{stripHash(tag.label)}</Text>
              </Pressable>
            );
          })}
        </View>

        {draft.selectedTagIds.length > 0 ? (
          <View style={styles.broadcastSection}>
            <Text style={[styles.sectionEyebrow, bodyTextStyle]}>어디에 올라가는지</Text>
            {privateOnly ? (
              <View style={styles.privateOnlyCard}>
                <Text style={[styles.privateOnlyText, bodyTextStyle]}>
                  <Text style={styles.strong}>나만 보기</Text> · 개인공간 캘린더에만 저장돼요
                </Text>
              </View>
            ) : null}
            {draft.resolvedTargets.map((target, index) => {
              const off = draft.disabledGroupIds.includes(target.groupId);
              const tone = toneForTag(target.matchedGroupTagLabels[0], index);

              return (
                <View key={target.groupId} style={[styles.targetRow, off ? styles.targetRowOff : undefined]}>
                  <View style={[styles.targetAvatar, { backgroundColor: paperColors[tone] }]}>
                    <Text style={styles.targetAvatarText}>{Array.from(target.groupName)[0] ?? '?'}</Text>
                  </View>
                  <View style={styles.targetCopy}>
                    <Text numberOfLines={1} style={[styles.targetName, strongTextStyle, off ? styles.targetNameOff : undefined]}>
                      {target.groupName}
                    </Text>
                    <Text numberOfLines={1} style={[styles.targetMeta, bodyTextStyle]}>
                      {target.matchedGroupTagLabels.map((label) => `#${stripHash(label)}`).join(' ')} 로 집계
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`${target.groupName} 공유 ${off ? '켜기' : '끄기'}`}
                    onPress={() => onToggleShareTarget(target.groupId)}
                    style={[styles.targetSwitch, !off ? styles.targetSwitchOn : undefined]}>
                    <View style={[styles.targetSwitchKnob, !off ? styles.targetSwitchKnobOn : undefined]} />
                  </Pressable>
                </View>
              );
            })}
            {activeTargets.length > 0 && selectedPersonalTagCount > 0 ? (
              <View style={styles.privateOnlyCard}>
                <Text style={[styles.privateOnlyText, bodyTextStyle]}>
                  개인 태그 {selectedPersonalTagCount}개도 개인공간에 저장돼요
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {deniedPermissions.length > 0 ? (
          <View style={styles.directoryErrorCard}>
            <Text style={[styles.directoryErrorText, bodyTextStyle]}>
              권한이 막힌 항목이 있어요. 사진을 바꾸려면 설정에서 허용해주세요.
            </Text>
            <PaperButton label="설정으로" onPress={onOpenSettings} tone="light" />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.stickyCta, { paddingBottom: bottomInset + 22 }]}>
        <PaperButton
          disabled={!canGoNext || isUploading}
          label={canGoNext ? '다음 · 한마디 적기' : '태그를 골라줘'}
          onPress={onNext}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

type CaptionScreenProps = {
  activeTargets: { groupName: string }[];
  bottomInset: number;
  canSubmit: boolean;
  draft: ReturnType<typeof useCaptureSession>['draft'];
  isUploading: boolean;
  onBack: () => void;
  onCancel: () => void;
  onResumeEditing: () => void;
  onSetCaption: (caption: string) => void;
  onSubmit: () => void;
  selectedTags: CaptureTagOption[];
  stage: string;
  topInset: number;
  uploadJob: ReturnType<typeof useCaptureSession>['uploadJob'];
};

function CaptionScreen({
  activeTargets,
  bottomInset,
  canSubmit,
  draft,
  isUploading,
  onBack,
  onCancel,
  onResumeEditing,
  onSetCaption,
  onSubmit,
  selectedTags,
  stage,
  topInset,
  uploadJob,
}: CaptionScreenProps) {
  const { bodyTextStyle, strongTextStyle } = useFontPreference();
  const firstTag = selectedTags[0];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.paperScreen}>
      <View style={[styles.stepTopBar, { paddingTop: topInset + 4 }]}>
        <Pressable accessibilityLabel="태그 선택으로 돌아가기" disabled={isUploading} onPress={onBack} style={styles.stepBackButton}>
          <Ionicons color={isUploading ? paperColors.ink3 : paperColors.ink0} name="chevron-back" size={22} />
        </Pressable>
        <Text style={[styles.stepTitle, strongTextStyle]}>
          한마디 적을래? <Text style={styles.optionalText}>선택</Text>
        </Text>
        <Pressable disabled={isUploading} onPress={onCancel} style={styles.closeTextButton}>
          <Text style={[styles.closeTextButtonText, bodyTextStyle, isUploading ? styles.mutedText : undefined]}>취소</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.captionScrollContent, { paddingBottom: bottomInset + 132 }]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.bigPolaroidWrap}>
          <View style={styles.bigPolaroid}>
            <Tape angle={-8} left={84} top={-12} width={70} />
            <PhotoBlock
              height={220}
              label=""
              tone={toneForTag(firstTag?.label)}
              uri={draft.asset?.uri}
              width={220}
            />
          </View>
        </View>

        <View style={styles.selectedTagRow}>
          {selectedTags.map((tag, index) => {
            const tone = toneForTag(tag.label, index);
            return (
              <Text key={tag.id} style={[styles.selectedTag, { backgroundColor: paperColors[tone] }]}>
                #{stripHash(tag.label)}
              </Text>
            );
          })}
        </View>

        <View style={styles.captionInputCard}>
          <Text style={[styles.inputEyebrow, bodyTextStyle]}>오늘의 한 줄</Text>
          <TextInput
            editable={!isUploading}
            maxLength={40}
            onChangeText={(value) => onSetCaption(value.slice(0, 40))}
            placeholder="필라테스 1시간 / 카페에서 4시간 집중 ..."
            placeholderTextColor={paperColors.ink3}
            style={[styles.captionInput, strongTextStyle]}
            value={draft.caption}
          />
          <Text style={[styles.captionCount, bodyTextStyle]}>{draft.caption.length}/40</Text>
        </View>

        <View style={styles.uploadSummary}>
          <Text style={[styles.uploadSummaryTitle, strongTextStyle]}>✓ 올리면</Text>
          <Text style={[styles.uploadSummaryText, bodyTextStyle]}>· 개인공간 캘린더에 기록돼요</Text>
          {activeTargets.length > 0 ? (
            <Text style={[styles.uploadSummaryText, bodyTextStyle]}>
              · <Text style={styles.strong}>{activeTargets.map((target) => target.groupName).join(', ')}</Text>에도 자동 공유
            </Text>
          ) : (
            <Text style={[styles.uploadSummaryText, bodyTextStyle]}>· 선택한 그룹 공유는 꺼져 있어요</Text>
          )}
        </View>

        {draft.lastError ? (
          <View style={styles.uploadErrorCard}>
            <View style={styles.errorTitleRow}>
              <Ionicons color={paperColors.ink0} name="alert-circle-outline" size={18} />
              <Text style={[styles.errorTitle, strongTextStyle]}>업로드를 완료하지 못했어요</Text>
            </View>
            <Text selectable style={[styles.errorBody, bodyTextStyle]}>{draft.lastError}</Text>
            {uploadJob.errorPhase ? (
              <Text style={[styles.errorMeta, bodyTextStyle]}>실패 단계: {formatUploadPhaseLabel(uploadJob.errorPhase)}</Text>
            ) : null}
            {uploadJob.errorCode ? <Text style={[styles.errorMeta, bodyTextStyle]}>오류 코드: {uploadJob.errorCode}</Text> : null}
            {uploadJob.errorDetails ? (
              <Text selectable style={styles.errorLog}>
                {uploadJob.errorDetails}
              </Text>
            ) : null}
          </View>
        ) : null}

        {isUploading ? (
          <View style={styles.uploadingCard}>
            <ActivityIndicator color={paperColors.coral} />
            <View style={styles.uploadingCopy}>
              <Text style={[styles.uploadingTitle, strongTextStyle]}>업로드 진행 중</Text>
              <Text style={[styles.uploadingText, bodyTextStyle]}>
                {uploadJob.progressPhase === 'prepareUpload'
                  ? '사진을 정리하고 있어요.'
                  : uploadJob.progressPhase === 'uploadMedia'
                    ? '이미지 파일을 전송하고 있어요.'
                    : '인증과 공유 대상을 저장하고 있어요.'}
              </Text>
            </View>
          </View>
        ) : null}

        {stage === 'failure' ? (
          <Pressable onPress={onResumeEditing} style={styles.editAgainButton}>
            <Text style={[styles.editAgainButtonText, strongTextStyle]}>문구와 태그 다시 보기</Text>
          </Pressable>
        ) : null}

      </ScrollView>

      <View style={[styles.stickyCta, { paddingBottom: bottomInset + 22 }]}>
        <PaperButton
          disabled={!canSubmit}
          label={stage === 'failure' ? '다시 시도 →' : '공유하기 →'}
          onPress={onSubmit}
          tone="coral"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

type SuccessScreenProps = {
  bottomInset: number;
  lastCompletedUpload: ReturnType<typeof useCaptureSession>['lastCompletedUpload'];
  onAnother: () => void;
  onClose: () => void;
  topInset: number;
};

function SuccessScreen({ bottomInset, lastCompletedUpload, onAnother, onClose, topInset }: SuccessScreenProps) {
  return (
    <View style={styles.paperScreen}>
      <View style={[styles.successTopBar, { paddingTop: topInset + 6 }]}>
        <View style={styles.topPlaceholder} />
        <Pressable accessibilityLabel="홈으로 돌아가기" onPress={onClose} style={styles.successCloseButton}>
          <Ionicons color={paperColors.ink0} name="close" size={22} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.successContent,
          { paddingBottom: bottomInset + 28 },
        ]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.successStamp}>완료</Text>
        <Text style={styles.successTitle}>
          {lastCompletedUpload
            ? lastCompletedUpload.completedGroupCount > 0 && lastCompletedUpload.personalTagLabels.length > 0
              ? `${lastCompletedUpload.completedGroupCount}개 그룹 + 개인공간 저장 완료`
              : lastCompletedUpload.completedGroupCount > 0
                ? `${lastCompletedUpload.completedGroupCount}개 그룹에 공유 완료`
                : '개인공간 저장 완료'
            : '공유가 완료됐어요'}
        </Text>
        <Text style={styles.successText}>
          같은 태그 화면에는 최신 인증이 반영돼요. 원할 때 닫고 돌아가면 됩니다.
        </Text>
        {lastCompletedUpload ? (
          <>
            <View style={styles.successPolaroid}>
              <PhotoBlock
                height={220}
                label=""
                tone={toneForTag(lastCompletedUpload.groupTagLabels[0] ?? lastCompletedUpload.personalTagLabels[0])}
                uri={lastCompletedUpload.imageUri}
                width="100%"
              />
            </View>
            <Text style={styles.successMeta}>
              수정 가능 · {formatTimestampLabel(lastCompletedUpload.editableUntil)}
            </Text>
            <View style={styles.selectedTagRow}>
              {lastCompletedUpload.personalTagLabels.map((tag) => (
                <Text key={`personal-${tag}`} style={[styles.selectedTag, { backgroundColor: paperColors.sage }]}>
                  #{stripHash(tag)}
                </Text>
              ))}
              {lastCompletedUpload.groupTagLabels.map((tag) => (
                <Text key={`group-${tag}`} style={[styles.selectedTag, { backgroundColor: paperColors.peach }]}>
                  #{stripHash(tag)}
                </Text>
              ))}
            </View>
          </>
        ) : null}
        <PaperButton label="하나 더 인증하기" onPress={onAnother} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bigPolaroid: {
    backgroundColor: paperColors.card,
    padding: 12,
    paddingBottom: 12,
    position: 'relative',
    transform: [{ rotate: '-1.5deg' }],
    ...paperShadow,
  },
  bigPolaroidWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  broadcastSection: {
    gap: 8,
    marginTop: 22,
  },
  captionCount: {
    color: paperColors.ink3,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
    textAlign: 'right',
  },
  captionInput: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 16,
    lineHeight: 21,
    paddingVertical: 4,
  },
  captionInputCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  captionScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  captureControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 10,
  },
  captureScreen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  captureTitle: {
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.pen,
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
  },
  captureTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 18,
  },
  cameraPermissionPrompt: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cameraPermissionText: {
    color: 'rgba(253,251,245,0.68)',
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  cameraPermissionTitle: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 17,
    lineHeight: 22,
  },
  closeIconButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  closeTextButton: {
    alignItems: 'flex-end',
    minWidth: 44,
    paddingVertical: 6,
  },
  closeTextButtonText: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  controlLabel: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    letterSpacing: 0.6,
    lineHeight: 14,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  controlSpacer: {
    height: 46,
    width: 46,
  },
  directoryErrorCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink2,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.3,
    gap: 10,
    padding: 12,
    width: '100%',
  },
  directoryErrorText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 18,
  },
  disabledButton: {
    opacity: 0.45,
  },
  editAgainButton: {
    alignSelf: 'center',
    marginTop: 12,
    padding: 8,
  },
  editAgainButtonText: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
    textDecorationLine: 'underline',
  },
  emptyTagText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 18,
  },
  errorBody: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 18,
  },
  errorLog: {
    backgroundColor: paperColors.paper1,
    borderColor: paperColors.ink3,
    borderRadius: 8,
    borderWidth: 1,
    color: paperColors.ink2,
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 15,
    padding: 10,
  },
  errorMeta: {
    color: paperColors.ink3,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
  },
  errorTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
  },
  errorTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  focusBox: {
    borderColor: 'rgba(253,251,245,0.5)',
    borderWidth: 1.2,
    height: 70,
    left: '50%',
    marginLeft: -35,
    marginTop: -35,
    position: 'absolute',
    top: '50%',
    width: 70,
  },
  focusCorner: {
    height: 10,
    position: 'absolute',
    width: 10,
  },
  focusCornerBottomLeft: {
    borderBottomColor: paperColors.card,
    borderBottomWidth: 2,
    borderLeftColor: paperColors.card,
    borderLeftWidth: 2,
    bottom: -4,
    left: -4,
  },
  focusCornerBottomRight: {
    borderBottomColor: paperColors.card,
    borderBottomWidth: 2,
    borderRightColor: paperColors.card,
    borderRightWidth: 2,
    bottom: -4,
    right: -4,
  },
  focusCornerTopLeft: {
    borderLeftColor: paperColors.card,
    borderLeftWidth: 2,
    borderTopColor: paperColors.card,
    borderTopWidth: 2,
    left: -4,
    top: -4,
  },
  focusCornerTopRight: {
    borderRightColor: paperColors.card,
    borderRightWidth: 2,
    borderTopColor: paperColors.card,
    borderTopWidth: 2,
    right: -4,
    top: -4,
  },
  galleryButton: {
    alignItems: 'center',
  },
  galleryThumb: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 10,
    borderWidth: 1.6,
    height: 46,
    overflow: 'hidden',
    padding: 4,
    width: 46,
  },
  galleryThumbInner: {
    backgroundColor: paperColors.paper2,
    flex: 1,
  },
  inlineStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  inlineStatusText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 18,
  },
  inputEyebrow: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    letterSpacing: 1,
    lineHeight: 14,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  mutedText: {
    color: paperColors.ink3,
  },
  newTagButton: {
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.3,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newTagButtonText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 16,
  },
  newTagCreateButton: {
    backgroundColor: paperColors.ink0,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newTagCreateText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 16,
  },
  newTagInput: {
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 19,
    minWidth: 120,
    paddingVertical: 4,
  },
  newTagRow: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    padding: 8,
  },
  optionalText: {
    color: paperColors.ink3,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
  },
  paperButton: {
    alignItems: 'center',
    backgroundColor: paperColors.ink0,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#0A0908',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  paperButtonCoral: {
    backgroundColor: paperColors.coral,
  },
  paperButtonLight: {
    backgroundColor: paperColors.card,
    shadowOpacity: 0,
  },
  paperButtonText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 18,
  },
  paperButtonTextDark: {
    color: paperColors.ink0,
  },
  paperScreen: {
    backgroundColor: paperColors.paper0,
    flex: 1,
  },
  permissionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  permissionCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 12,
    borderWidth: 1.3,
    gap: 7,
    padding: 12,
  },
  permissionNotes: {
    gap: 8,
    paddingHorizontal: 18,
  },
  permissionText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
  },
  permissionTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 18,
  },
  previewPolaroid: {
    backgroundColor: paperColors.card,
    padding: 8,
    paddingBottom: 8,
    position: 'relative',
    transform: [{ rotate: '-1.8deg' }],
    ...paperShadow,
  },
  previewPolaroidWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  privateOnlyCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink2,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  privateOnlyText: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 18,
  },
  replaceButton: {
    alignItems: 'flex-end',
    minWidth: 52,
    paddingVertical: 6,
  },
  replaceButtonText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 16,
  },
  scanLines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  sectionEyebrow: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  selectedTag: {
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.3,
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 11,
    lineHeight: 15,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  selectedTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 18,
  },
  shutterButton: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 2.5,
    height: 82,
    justifyContent: 'center',
    padding: 5,
    shadowColor: paperColors.ink0,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    width: 82,
  },
  shutterInner: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  stepBackButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  stepTitle: {
    color: paperColors.ink0,
    flex: 1,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
  },
  stepTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
    paddingHorizontal: 18,
  },
  stickyCta: {
    backgroundColor: 'rgba(251,247,240,0.94)',
    bottom: 0,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    position: 'absolute',
    right: 0,
  },
  strong: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
  },
  successContent: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  successCloseButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  successMeta: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
  },
  successPolaroid: {
    backgroundColor: paperColors.card,
    padding: 12,
    paddingBottom: 12,
    position: 'relative',
    transform: [{ rotate: '-1.2deg' }],
    width: '100%',
    ...paperShadow,
  },
  successStamp: {
    borderColor: paperColors.coral,
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 2,
    color: paperColors.coral,
    fontFamily: paperFonts.pen,
    fontSize: 34,
    lineHeight: 42,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 10,
    transform: [{ rotate: '-10deg' }],
  },
  successText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  successTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  successTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
  },
  tagChip: {
    alignItems: 'center',
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.3,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagChipActive: {
    shadowColor: paperColors.ink0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tagChipLabel: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  tagChipPrivate: {
    borderColor: paperColors.ink2,
    borderStyle: 'dashed',
  },
  tagChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagHeaderRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tagScrollContent: {
    paddingHorizontal: 18,
  },
  targetAvatar: {
    alignItems: 'center',
    borderColor: paperColors.ink0,
    borderRadius: 8,
    borderWidth: 1.3,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  targetAvatarText: {
    color: paperColors.ink0,
    fontFamily: paperFonts.pen,
    fontSize: 18,
    lineHeight: 22,
  },
  targetCopy: {
    flex: 1,
    minWidth: 0,
  },
  targetMeta: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
  },
  targetName: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  targetNameOff: {
    textDecorationLine: 'line-through',
  },
  targetRow: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  targetRowOff: {
    opacity: 0.5,
  },
  targetSwitch: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 999,
    borderWidth: 1.3,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 2,
    width: 42,
  },
  targetSwitchKnob: {
    backgroundColor: paperColors.ink0,
    borderRadius: 999,
    height: 18,
    width: 18,
  },
  targetSwitchKnobOn: {
    alignSelf: 'flex-end',
    backgroundColor: paperColors.card,
  },
  targetSwitchOn: {
    backgroundColor: paperColors.ink0,
  },
  topPlaceholder: {
    width: 32,
  },
  uploadErrorCard: {
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
    marginTop: 16,
    padding: 14,
  },
  uploadSummary: {
    borderColor: paperColors.ink2,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.3,
    gap: 4,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  uploadSummaryText: {
    color: paperColors.ink1,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 19,
  },
  uploadSummaryTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
  },
  uploadingCard: {
    alignItems: 'center',
    backgroundColor: paperColors.card,
    borderColor: paperColors.ink0,
    borderRadius: 14,
    borderWidth: 1.4,
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    padding: 14,
  },
  uploadingCopy: {
    flex: 1,
    gap: 3,
  },
  uploadingText: {
    color: paperColors.ink2,
    fontFamily: paperFonts.handBold,
    fontSize: 12,
    lineHeight: 17,
  },
  uploadingTitle: {
    color: paperColors.ink0,
    fontFamily: paperFonts.handBold,
    fontSize: 15,
    lineHeight: 20,
  },
  viewfinderBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(27,26,23,0.45)',
    gap: 8,
    justifyContent: 'center',
  },
  viewfinderBusyText: {
    color: paperColors.card,
    fontFamily: paperFonts.handBold,
    fontSize: 13,
    lineHeight: 17,
  },
  viewfinderCaption: {
    bottom: 14,
    color: paperColors.ink1,
    fontFamily: paperFonts.pen,
    fontSize: 20,
    left: 0,
    lineHeight: 25,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
  viewfinderCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  viewfinderPolaroid: {
    backgroundColor: paperColors.card,
    borderColor: 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    padding: 14,
    paddingBottom: 56,
    position: 'relative',
    transform: [{ rotate: '-1.2deg' }],
    ...paperShadow,
  },
  viewfinderSquare: {
    backgroundColor: '#1E1A15',
    height: 260,
    overflow: 'hidden',
    position: 'relative',
    width: 260,
  },
});
