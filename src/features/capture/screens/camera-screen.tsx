import { useEffect } from 'react';
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
import type { MediaSource } from '@/features/capture/types';
import { useAppColors } from '@/hooks/use-app-colors';
import { formatLifeDayLabel, formatTimestampLabel } from '@/lib/life-day';

const sourceLabels: Record<MediaSource, string> = {
  camera: '카메라',
  library: '갤러리',
};

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
    lastCompletedUpload,
    simulateFailureOnce,
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

  const isBusyPreparing = stage === 'permissionCheck' || stage === 'captureOrPick';
  const isUploading = uploadJob.status === 'running';
  const canSubmit =
    Boolean(draft.asset) &&
    draft.selectedTagIds.length > 0 &&
    draft.resolvedTargets.length > 0 &&
    !isUploading;
  const deniedPermissions = (Object.values(permissions) ?? []).filter((permission) => !permission?.granted);
  const isShareRoute = pathname === '/capture/share';

  useEffect(() => {
    if (isFocused && stage === 'idle') {
      openSourceSelector();
    }
  }, [isFocused, openSourceSelector, stage]);

  useEffect(() => {
    if (!isFocused || stage !== 'cancelled') {
      return;
    }

    router.replace('/(tabs)/index');
    discardDraft('idle');
  }, [discardDraft, isFocused, stage]);

  useEffect(() => {
    if (!isFocused || stage !== 'success') {
      return;
    }

    const timer = setTimeout(() => {
      router.replace('/(tabs)/index');
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
        router.replace('/(tabs)/index');
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
      router.replace('/(tabs)/index');
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

    if (isShareRoute && navigation.canGoBack()) {
      router.back();
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
          <Text style={[styles.cardTitle, { color: colors.text }]}>사진을 어떻게 가져올까요?</Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            Android 실기기 기준으로 권한은 버튼을 누른 직후에만 요청합니다.
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
          <Text style={[styles.cardTitle, { color: colors.text }]}>미리보기</Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            편집 없이 사진만 확인하고 다음 단계로 넘어갑니다.
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
    return (
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>공유 대상 요약</Text>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          선택한 그룹 태그 라벨을 기준으로 매칭된 그룹만 묶어서 보여줍니다.
        </Text>
        {draft.resolvedTargets.length === 0 ? (
          <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
            태그를 선택하면 공유될 그룹이 여기에 나타납니다.
          </Text>
        ) : (
          <View style={styles.targetList}>
            {draft.resolvedTargets.map((target) => (
              <View
                key={target.groupId}
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
          <Text style={[styles.cardTitle, { color: colors.text }]}>공유 준비</Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            문구는 인증 본문이고, 이미지 위 코멘트는 업로드 후 그룹 상세에서 남깁니다.
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
            그룹이 아니라 태그를 고릅니다. 각 태그는 연결 그룹 수를 함께 보여줍니다.
          </Text>
          <View style={styles.tagRow}>
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
                    {tag.connectedGroupCount}개 그룹
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
            {uploadJob.errorCode ? (
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                오류 코드: {uploadJob.errorCode}
              </Text>
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
              ? `${lastCompletedUpload.completedGroupCount}개 그룹에 공유 완료`
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
              {lastCompletedUpload.targets.map((target) => (
                <View
                  key={target.groupId}
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
        ? 'sourceSelect'
        : stage === 'permissionCheck'
          ? 'permissionCheck'
          : stage === 'captureOrPick'
            ? 'captureOrPick'
            : stage === 'preview'
              ? 'preview'
              : stage === 'compose'
                ? 'compose'
                : stage === 'prepareUpload'
                  ? 'prepareUpload'
                  : stage === 'uploadMedia'
                    ? 'uploadMedia'
                    : stage === 'saveCertification'
                      ? 'saveCertification/shareTargets'
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
          <Text style={[styles.eyebrow, { color: colors.accent }]}>Capture Flow</Text>
          <Text style={[styles.title, { color: colors.text }]}>카메라 / 인증 업로드</Text>
          <Text style={[styles.heroDescription, { color: colors.textMuted }]}>
            카메라 탭 진입부터 사진 확보, 태그 기반 다중 공유, 실패 복구까지를 한 세션 안에서 처리합니다.
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
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stagePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    borderRadius: 22,
    backgroundColor: '#D1D5DB',
  },
  composeImage: {
    width: '100%',
    aspectRatio: 0.95,
    borderRadius: 22,
    backgroundColor: '#D1D5DB',
  },
  successImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: '#D1D5DB',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaChip: {
    minWidth: 120,
    gap: 4,
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
  tagChip: {
    borderRadius: 18,
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
