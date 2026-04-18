import { useMemo, type RefObject } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AppButton } from '@/components/ui/app-button';
import { colors, radius, shadow, spacing, typography } from '@/constants/tokens';

import type { GroupRow } from '@/lib/supabase';
import type { GroupTagEntry } from '../hooks/use-group-detail';
import { StoryShareCard } from './story-share-card';

type StoryShareModalProps = {
  visible: boolean;
  group: GroupRow;
  tagEntry: GroupTagEntry;
  isExporting: boolean;
  errorMessage?: string | null;
  captureRef: RefObject<ViewShot | null>;
  onClose: () => void;
  onSave: () => void;
  onSaveAndShare: () => void;
};

export function StoryShareModal({
  visible,
  group,
  tagEntry,
  isExporting,
  errorMessage,
  captureRef,
  onClose,
  onSave,
  onSaveAndShare,
}: StoryShareModalProps) {
  const { width, height } = useWindowDimensions();
  const cardWidth = useMemo(() => Math.min(width - 32, 360), [width]);
  const cardHeight = useMemo(() => cardWidth * (16 / 9), [cardWidth]);
  const previewScale = useMemo(() => Math.min(1, (height * 0.68) / cardHeight), [cardHeight, height]);

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.backdrop}>
          <Animated.View entering={FadeInDown.duration(220)} style={styles.modalHeader}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerEyebrow}>Share Mode</Text>
              <Text style={styles.headerTitle}>9:16 스토리 프레임으로 저장</Text>
            </View>
            <Pressable accessibilityLabel="공유 모드 닫기" onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.text.primary} name="close" size={20} />
            </Pressable>
          </Animated.View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <Animated.View
              entering={FadeInUp.duration(260).delay(60)}
              style={[
                styles.previewWrap,
                {
                  width: cardWidth,
                  height: cardHeight,
                  transform: [{ scale: previewScale }],
                  marginVertical: -((cardHeight * (1 - previewScale)) / 2),
                },
              ]}>
              <ViewShot ref={captureRef} style={{ width: cardWidth, height: cardHeight }}>
                <StoryShareCard group={group} tagEntry={tagEntry} width={cardWidth} />
              </ViewShot>
            </Animated.View>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons color={colors.text.primary} name="warning-outline" size={18} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Animated.View entering={FadeInUp.duration(220).delay(120)} style={styles.actionGroup}>
              <AppButton
                label={isExporting ? '저장 후 공유 준비 중...' : '저장 후 공유하기'}
                onPress={onSaveAndShare}
                disabled={isExporting}
              />
              <AppButton
                label={isExporting ? '이미지 저장 중...' : '이미지만 저장'}
                onPress={onSave}
                variant="secondary"
                disabled={isExporting}
              />
              <AppButton label="돌아가기" onPress={onClose} variant="secondary" disabled={isExporting} />
            </Animated.View>

            {isExporting ? (
              <View style={styles.exportState}>
                <ActivityIndicator color={colors.brand.primary} />
                <Text style={styles.exportStateText}>
                  캡처, 사진 저장, 공유 시트 순서로 진행 중입니다.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xxs,
    paddingRight: spacing.md,
  },
  headerEyebrow: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: typography.eyebrow.fontWeight,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: colors.text.inverse,
    fontSize: 18,
    fontWeight: typography.title.fontWeight,
    lineHeight: 24,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  previewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sheet,
  },
  scrollContent: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderColor: colors.line.soft,
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: 360,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: colors.text.primary,
    flex: 1,
    fontSize: typography.label.fontSize,
    lineHeight: 20,
  },
  actionGroup: {
    gap: spacing.sm,
    maxWidth: 360,
    width: '100%',
  },
  exportState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exportStateText: {
    color: colors.text.inverse,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    lineHeight: 18,
  },
});
