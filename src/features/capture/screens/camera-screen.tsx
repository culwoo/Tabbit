import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation, usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { AppHeader } from '@/components/shell/app-header';
import { AppButton } from '@/components/ui/app-button';
import { useCaptureSession } from '@/features/capture/capture-session';
import type { MediaSource, UploadProgressPhase } from '@/features/capture/types';
import { useAppColors } from '@/hooks/use-app-colors';
import { formatLifeDayLabel, formatTimestampLabel } from '@/lib/life-day';

const sourceLabels: Record<MediaSource, string> = {
  camera: '카메라',
  library: '갤러리',
};

const uploadPhaseLabels: Record<UploadProgressPhase, string> = {
  idle: '대기',
  prepareUpload: '이미지 준비',
  uploadMedia: 'Storage 이미지 업로드',
  'saveCertification/shareTargets': '인증/공유 대상 저장',
};

function formatUploadPhaseLabel(phase: UploadProgressPhase | null) {
  return phase ? uploadPhaseLabels[phase] : null;
}

export default function CameraScreen() {
  const colors = useAppColors();
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const pathname = usePathname();
  const {
    stage,
    draft,
    permissions,
    uploadJob,
    availableTags,
    tagDirectoryStatus,
    tagDirectoryError,
    lastCompletedUpload,
    simulateFailureOnce,
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
  } = useCaptureSession();

  const [newPersonalTagLabel, setNewPersonalTagLabel] = useState('');
  const [isCreatingPersonalTag, setCreatingPersonalTag] = useState(false);

  const isBusyPreparing = stage === 'permissionCheck' || stage === 'captureOrPick';
  const isUploading = uploadJob.status === 'running';
  const canSubmit =
    Boolean(draft.asset) &&
    draft.selectedTagIds.length > 0 &&
    tagDirectoryStatus === 'ready' &&
    !isUploading;
  const deniedPermissions = (Object.values(permissions) ?? []).filter((permission) => !permission?.granted);
  const isShareRoute = pathname === '/capture/share';

  useEffect(() => {
    if (isFocused && stage === 'idle') {
      openSourceSelector();
    }
  }, [isFocused, openSourceSelector, stage]);

  useEffect(() => {
    if (isFocused) {
      void reloadCaptureTags();
    }
  }, [isFocused, reloadCaptureTags]);

  useEffect(() => {
    if (!isFocused || stage !== 'cancelled') {
      return;
    }

    router.replace('/');
    discardDraft('idle');
  }, [discardDraft, isFocused, stage]);

  useEffect(() => {
    if (!isFocused || stage !== 'success') {
      return;
    }

    const timer = setTimeout(() => {
      router.replace('/');
      discardDraft('idle');
    }, 1400);

    return () => clearTimeout(timer);
  }, [discardDraft, isFocused, stage]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const showDiscardAlert = () => {
      Alert.alert('초안을 버릴까요?', '촬영한 사진과 입력한 문구, 선택한 태그가 사라집니다.', [
        {
          text: '계속 편집',
          style: 'cancel',
        },
        {
          text: '버리고 나가기',
          style: 'destructive',
          onPress: () => {
            cancelFlow();
          },
        },
      ]);
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isUploading) {
        return true;
      }

      if (stage === 'sourceSelect') {
        cancelFlow();
        return true;
      }

      if (stage === 'preview' || stage === 'compose' || stage === 'failure') {
        showDiscardAlert();
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
  }, [cancelFlow, discardDraft, isFocused, isUploading, navigation, stage]);

  function confirmDiscardDraft() {
    Alert.alert('초안을 버릴까요?', '촬영한 사진과 입력한 문구, 선택한 태그가 사라집니다.', [
      {
        text: '계속 편집',
        style: 'cancel',
      },
      {
        text: '버리고 나가기',
        style: 'destructive',
        onPress: () => {
          cancelFlow();
        },
      },
    ]);
  }

  function handleSourcePress(source: MediaSource) {
    void requestAssetFromSource(source);
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

  function openAppSettings() {
    void Linking.openSettings();
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

  function handleReturnToPreview() {
    goToPreview();

    if (isShareRoute) {
      if (navigation.canGoBack()) {
        router.back();
      } else {
        router.replace('/capture');
      }
    }
  }

  function renderPermissionHelp() {
    if (deniedPermissions.length === 0) {
      return null;
    }

    return deniedPermissions.map((permission) => (
      <View
        key={permission.source}
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.warningSoft,
            borderColor: colors.border,
          },
        ]}>
        <View style={styles.permissionHeader}>
          <Ionicons name="shield-outline" size={18} color={colors.text} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {sourceLabels[permission.source]} 권한이 필요합니다
          </Text>
        </View>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          {permission.canAskAgain
            ? `${sourceLabels[permission.source]} 접근이 거부되었습니다. 다시 허용을 눌러 권한 요청을 이어가세요.`
            : `${sourceLabels[permission.source]} 접근이 영구 거부되었습니다. 설정에서 권한을 직접 허용해야 합니다.`}
        </Text>
        <View style={styles.rowActions}>
          {permission.canAskAgain ? (
            <View style={styles.flexAction}>
              <AppButton
                label="다시 허용"
                onPress={() => handleSourcePress(permission.source)}
                variant="secondary"
              />
            </View>
          ) : null}
          <View style={styles.flexAction}>
            <AppButton label="설정으로 이동" onPress={openAppSettings} variant="secondary" />
          </View>
        </View>
      </View>
    ));
  }

  function renderSourceSelect() {
    return (
      <>
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>오늘 인증 사진을 골라주세요</Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            바로 촬영하거나 갤러리에서 이미 찍어둔 사진을 가져올 수 있어요.
          </Text>
          <View style={styles.actionColumn}>
            <AppButton
              label={isBusyPreparing && stage === 'permissionCheck' ? '권한 확인 중...' : '촬영하기'}
              onPress={() => handleSourcePress('camera')}
              disabled={isBusyPreparing}
            />
            <AppButton
              label={stage === 'captureOrPick' ? '사진 준비 중...' : '갤러리에서 선택'}
              onPress={() => handleSourcePress('library')}
              variant="secondary"
              disabled={isBusyPreparing}
            />
            <AppButton label="취소" onPress={cancelFlow} variant="secondary" disabled={isBusyPreparing} />
          </View>
        </View>
        {isBusyPreparing ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}>
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                {stage === 'permissionCheck'
                  ? '권한 상태를 확인하고 있습니다.'
                  : `${draft.sourceType ? sourceLabels[draft.sourceType] : '사진'}를 불러오고 있습니다.`}
              </Text>
            </View>
          </View>
        ) : null}
        {renderPermissionHelp()}
      </>
    );
  }

  function renderPreview() {
    if (!draft.asset) {
      return null;
    }

    return (
      <>
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>사진 확인</Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            인증에 사용할 사진이 맞는지 한 번만 확인해 주세요.
          </Text>
          <Image source={{ uri: draft.asset.uri }} style={styles.previewImage} />
          <View style={styles.metaGrid}>
            <View style={styles.metaChip}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>출처</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {draft.sourceType ? sourceLabels[draft.sourceType] : '-'}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>해상도</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {draft.asset.width} × {draft.asset.height}
              </Text>
            </View>
          </View>
          <View style={styles.actionColumn}>
            <AppButton label="다시 찍기" onPress={() => handleReplaceAsset('camera')} />
            <AppButton
              label="다른 사진 선택"
              onPress={() => handleReplaceAsset('library')}
              variant="secondary"
            />
            <AppButton label="다음" onPress={handleContinueToShare} variant="secondary" />
            <AppButton label="취소" onPress={confirmDiscardDraft} variant="secondary" />
          </View>
        </View>
      </>
    );
  }

  function renderResolvedTargets() {
    const selectedPersonalTagCount = availableTags.filter(
      (tag) => tag.kind === 'personal' && draft.selectedTagIds.includes(tag.id),
    ).length;

    return (
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>공유될 곳</Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          선택한 태그와 연결된 그룹만 모아서 보여줍니다.
        </Text>
        {draft.resolvedTargets.length === 0 ? (
          <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
            {selectedPersonalTagCount > 0
              ? '선택한 개인 태그는 개인공간에 저장됩니다. 그룹 공유는 연결된 그룹 태그를 선택하면 추가됩니다.'
              : '태그를 선택하면 공유될 그룹이 여기에 나타납니다.'}
          </Text>
        ) : (
          <View style={styles.targetList}>
            {draft.resolvedTargets.map((target, targetIndex) => (
              <View
                key={`${target.groupId}-${target.matchedGroupTagIds.join('-')}-${targetIndex}`}
                style={[
                  styles.targetCard,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}>
                <View style={styles.targetHeader}>
                  <Text style={[styles.targetTitle, { color: colors.text }]}>{target.groupName}</Text>
                  <Text style={[styles.targetSubtitle, { color: colors.textMuted }]}>
                    {target.memberCount}명 · {target.thresholdSummary}
                  </Text>
                </View>
                <View style={styles.tagRow}>
                  {target.matchedGroupTagLabels.map((tagLabel) => (
                    <View
                      key={`${target.groupId}-${tagLabel}`}
                      style={[
                        styles.selectedTagBadge,
                        {
                          backgroundColor: colors.accentSoft,
                        },
                      ]}>
                      <Text style={[styles.selectedTagText, { color: colors.accent }]}>{tagLabel}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderCompose() {
    if (!draft.asset) {
      return null;
    }

    return (
      <>
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>한 줄 남기기</Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            오늘의 인증에 붙일 짧은 문구를 남겨보세요.
          </Text>
          <Image source={{ uri: draft.asset.uri }} style={styles.composeImage} />
          <TextInput
            value={draft.caption}
            onChangeText={setCaption}
            editable={!isUploading}
            placeholder="오늘의 인증 한 줄을 남겨보세요."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.captionInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            maxLength={80}
            multiline
          />
          <View style={styles.captionMetaRow}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
              {draft.caption.length}/80자
            </Text>
            <Pressable onPress={handleReturnToPreview} disabled={isUploading}>
              <Text
                style={[
                  styles.textLink,
                  {
                    color: isUploading ? colors.textMuted : colors.accent,
                  },
                ]}>
                사진 다시 보기
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>태그 선택</Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            같은 태그를 쓰는 그룹과 개인공간에 함께 저장됩니다.
          </Text>
          <View style={styles.tagRow}>
            {tagDirectoryStatus === 'loading' ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color={colors.accent} />
                <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                  내 그룹 태그를 불러오고 있습니다.
                </Text>
              </View>
            ) : null}
            {tagDirectoryStatus === 'ready' && availableTags.length === 0 ? (
              <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
                아직 선택할 태그가 없습니다. 아래에서 개인공간 태그를 바로 만들 수 있습니다.
              </Text>
            ) : null}
            {tagDirectoryStatus === 'failure' ? (
              <View style={styles.tagDirectoryError}>
                <Text style={[styles.emptyStateText, { color: colors.textMuted }]} selectable>
                  {tagDirectoryError ?? '태그 정보를 불러오지 못했습니다.'}
                </Text>
                <AppButton
                  label="태그 다시 불러오기"
                  onPress={() => void reloadCaptureTags()}
                  variant="secondary"
                  disabled={isUploading}
                />
              </View>
            ) : null}
            {availableTags.map((tag) => {
              const selected = draft.selectedTagIds.includes(tag.id);

              return (
                <Pressable
                  key={tag.id}
                  onPress={() => toggleTag(tag.id)}
                  disabled={isUploading}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: selected ? colors.accentSoft : colors.background,
                      borderColor: selected ? colors.accent : colors.border,
                      opacity: isUploading ? 0.65 : 1,
                    },
                  ]}>
                  <Text style={[styles.tagLabel, { color: selected ? colors.accent : colors.text }]}>
                    {tag.label}
                  </Text>
                  <Text style={[styles.tagMeta, { color: colors.textMuted }]}>
                    {tag.kind === 'personal'
                      ? '개인공간'
                      : tag.personalTagId
                        ? `${tag.connectedGroupCount}개 그룹 + 개인공간`
                        : `${tag.connectedGroupCount}개 그룹`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {tagDirectoryStatus === 'ready' ? (
            <View style={styles.personalTagCreator}>
              <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                원하는 태그가 없으면 개인공간 태그로 먼저 저장하세요.
              </Text>
              <View style={styles.personalTagInputRow}>
                <TextInput
                  value={newPersonalTagLabel}
                  onChangeText={setNewPersonalTagLabel}
                  editable={!isUploading && !isCreatingPersonalTag}
                  placeholder="예: #운동"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.personalTagInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  maxLength={24}
                  onSubmitEditing={() => void handleCreatePersonalTag()}
                />
                <View style={styles.personalTagButton}>
                  <AppButton
                    label={isCreatingPersonalTag ? '추가 중...' : '개인 태그 추가'}
                    onPress={() => void handleCreatePersonalTag()}
                    variant="secondary"
                    disabled={!newPersonalTagLabel.trim() || isUploading || isCreatingPersonalTag}
                  />
                </View>
              </View>
            </View>
          ) : null}
          {draft.selectedTagIds.length === 0 ? (
            <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
              공유하려면 최소 1개 태그를 선택해야 합니다.
            </Text>
          ) : null}
        </View>

        {renderResolvedTargets()}

        {draft.lastError ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.warningSoft,
                borderColor: colors.border,
              },
            ]}>
            <View style={styles.permissionHeader}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.text} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>업로드를 완료하지 못했습니다</Text>
            </View>
            <Text style={[styles.cardDescription, { color: colors.textMuted }]} selectable>
              {draft.lastError}
            </Text>
            {uploadJob.errorCode || uploadJob.errorPhase ? (
              <View style={styles.errorMetaList}>
                {uploadJob.errorPhase ? (
                  <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                    실패 단계: {formatUploadPhaseLabel(uploadJob.errorPhase)}
                  </Text>
                ) : null}
                {uploadJob.errorCode ? (
                  <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                    오류 코드: {uploadJob.errorCode}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {uploadJob.errorDetails ? (
              <View
                style={[
                  styles.errorLogBox,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}>
                <Text style={[styles.errorLogTitle, { color: colors.text }]}>원본 오류 로그</Text>
                <Text style={[styles.errorLogText, { color: colors.textMuted }]} selectable>
                  {uploadJob.errorDetails}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {isUploading ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}>
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.accent} />
              <View style={styles.busyCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>업로드 진행 중</Text>
                <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                  {uploadJob.progressPhase === 'prepareUpload'
                    ? '사진을 압축하고 업로드를 준비하고 있습니다.'
                    : uploadJob.progressPhase === 'uploadMedia'
                      ? '이미지 파일을 전송하고 있습니다.'
                      : '인증과 공유 대상을 저장하고 목록을 새로고침하고 있습니다.'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {__DEV__ ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}>
            <View style={styles.debugHeader}>
              <View style={styles.debugCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>개발용 실패 시뮬레이션</Text>
                <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                  다음 업로드 한 번만 네트워크 실패로 처리해 재시도 UX를 확인합니다.
                </Text>
              </View>
              <Switch
                value={simulateFailureOnce}
                onValueChange={setSimulateFailureOnce}
                disabled={isUploading}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.actionColumn}>
          <AppButton
            label={stage === 'failure' ? '다시 시도' : '공유하기'}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
          {stage === 'failure' ? (
            <AppButton label="문구 수정" onPress={handleResumeEditing} variant="secondary" />
          ) : null}
          <AppButton
            label="태그 수정"
            onPress={handleResumeEditing}
            variant="secondary"
            disabled={isUploading}
          />
          <AppButton label="취소" onPress={confirmDiscardDraft} variant="secondary" disabled={isUploading} />
        </View>
      </>
    );
  }

  function renderSuccess() {
    return (
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.successSoft,
            borderColor: colors.border,
          },
        ]}>
        <View style={styles.permissionHeader}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.text} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {lastCompletedUpload
              ? lastCompletedUpload.completedGroupCount > 0 && lastCompletedUpload.personalTagLabels.length > 0
                ? `${lastCompletedUpload.completedGroupCount}개 그룹 + 개인공간 저장 완료`
                : lastCompletedUpload.completedGroupCount > 0
                  ? `${lastCompletedUpload.completedGroupCount}개 그룹에 공유 완료`
                  : '개인공간 저장 완료'
              : '공유가 완료되었습니다'}
          </Text>
        </View>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          홈으로 잠시 후 돌아갑니다. 같은 세션 안에서는 최신 인증 정보가 홈에도 반영됩니다.
        </Text>
        {lastCompletedUpload ? (
          <>
            <Image source={{ uri: lastCompletedUpload.imageUri }} style={styles.successImage} />
            <View style={styles.metaGrid}>
              <View style={styles.metaChip}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>생활일</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>
                  {formatLifeDayLabel(lastCompletedUpload.lifestyleDate)}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>수정 가능</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>
                  {formatTimestampLabel(lastCompletedUpload.editableUntil)}
                </Text>
              </View>
            </View>
            <View style={styles.tagRow}>
              {lastCompletedUpload.personalTagLabels.map((tagLabel) => (
                <View
                  key={`personal-tag-${tagLabel}`}
                  style={[
                    styles.selectedTagBadge,
                    {
                      backgroundColor: colors.successSoft,
                    },
                  ]}>
                  <Text style={[styles.selectedTagText, { color: colors.text }]}>{tagLabel}</Text>
                </View>
              ))}
              {lastCompletedUpload.groupTagLabels.map((tagLabel) => (
                <View
                  key={`group-tag-${tagLabel}`}
                  style={[
                    styles.selectedTagBadge,
                    {
                      backgroundColor: colors.accentSoft,
                    },
                  ]}>
                  <Text style={[styles.selectedTagText, { color: colors.accent }]}>{tagLabel}</Text>
                </View>
              ))}
            </View>
            <View style={styles.tagRow}>
              {lastCompletedUpload.targets.map((target, targetIndex) => (
                <View
                  key={`${target.groupId}-${target.matchedGroupTagIds.join('-')}-${targetIndex}`}
                  style={[
                    styles.selectedTagBadge,
                    {
                      backgroundColor: colors.surface,
                    },
                  ]}>
                  <Text style={[styles.selectedTagText, { color: colors.text }]}>{target.groupName}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
        <AppButton label="한 장 더 인증하기" onPress={beginAnotherCapture} />
      </View>
    );
  }

  function renderStagePill() {
    const label =
      stage === 'sourceSelect'
        ? '사진 선택'
        : stage === 'permissionCheck'
          ? '권한 확인'
          : stage === 'captureOrPick'
            ? '사진 불러오기'
            : stage === 'preview'
              ? '사진 확인'
              : stage === 'compose'
                ? '공유 준비'
                : stage === 'prepareUpload'
                  ? '업로드 준비'
                  : stage === 'uploadMedia'
                    ? '사진 업로드'
                    : stage === 'saveCertification'
                      ? '기록 저장'
                      : stage;

    return (
      <View
        style={[
          styles.stagePill,
          {
            backgroundColor: colors.accentSoft,
          },
        ]}>
        <Ionicons name="git-branch-outline" size={14} color={colors.accent} />
        <Text style={[styles.stagePillText, { color: colors.accent }]}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader onBack={handleHeaderClose} title="인증 업로드" variant="capture" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          {
            backgroundColor: colors.background,
          },
        ]}>
        <View
          style={[
            styles.hero,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>Today proof</Text>
          <Text style={[styles.title, { color: colors.text }]}>오늘 인증 올리기</Text>
          <Text style={[styles.heroDescription, { color: colors.textMuted }]}>
            사진 한 장과 태그만 고르면 그룹 인증과 개인 기록이 함께 정리됩니다.
          </Text>
          {renderStagePill()}
        </View>

        {stage === 'sourceSelect' || stage === 'permissionCheck' || stage === 'captureOrPick'
          ? renderSourceSelect()
          : null}
        {stage === 'preview' ? renderPreview() : null}
        {stage === 'compose' ||
        stage === 'prepareUpload' ||
        stage === 'uploadMedia' ||
        stage === 'saveCertification' ||
        stage === 'failure'
          ? renderCompose()
          : null}
        {stage === 'success' ? renderSuccess() : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
    paddingBottom: 44,
  },
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 29,
    fontWeight: '900',
    lineHeight: 35,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  stagePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stagePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 26,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionColumn: {
    gap: 10,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flexAction: {
    minWidth: 130,
    flexGrow: 1,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  busyCopy: {
    flex: 1,
    gap: 4,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: '#D1D5DB',
  },
  composeImage: {
    width: '100%',
    aspectRatio: 0.95,
    borderRadius: 24,
    backgroundColor: '#D1D5DB',
  },
  successImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: '#D1D5DB',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
    minWidth: 120,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  captionInput: {
    minHeight: 96,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  captionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagDirectoryError: {
    gap: 10,
    width: '100%',
  },
  personalTagCreator: {
    gap: 10,
  },
  personalTagInputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  personalTagInput: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    minWidth: 150,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  personalTagButton: {
    minWidth: 132,
  },
  tagChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  tagLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  tagMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorMetaList: {
    gap: 4,
  },
  errorLogBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  errorLogTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  errorLogText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 17,
  },
  targetList: {
    gap: 10,
  },
  targetCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  targetHeader: {
    gap: 4,
  },
  targetTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  targetSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectedTagBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  debugCopy: {
    flex: 1,
    gap: 4,
  },
});
