import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { captureHandledError, trackEvent } from '@/lib/monitoring';
import { saveStoryCardSnapshot, type StoryCardRow } from '@/lib/supabase';

type ExportStoryShareParams = {
  captureTarget: Parameters<typeof captureRef>[0];
  groupId: string;
  tagId: string;
  lifeDay: string;
  exportedBy: string;
  shareAfterSave: boolean;
};

type ExportStoryShareResult =
  | {
      ok: true;
      imagePath: string;
      shared: boolean;
      storyCard: StoryCardRow;
    }
  | {
      ok: false;
      message: string;
      stage: 'capture' | 'permission' | 'save' | 'share';
    };

class StoryShareExportError extends Error {
  constructor(
    message: string,
    public readonly stage: 'capture' | 'permission' | 'save' | 'share',
  ) {
    super(message);
    this.name = 'StoryShareExportError';
  }
}

function getExportPlatform() {
  const expoOs = process.env.EXPO_OS;
  return expoOs === 'android' || expoOs === 'ios' || expoOs === 'web' ? expoOs : 'unknown';
}

export async function exportStoryShare({
  captureTarget,
  groupId,
  tagId,
  lifeDay,
  exportedBy,
  shareAfterSave,
}: ExportStoryShareParams): Promise<ExportStoryShareResult> {
  const baseContext = {
    userId: exportedBy,
    groupId,
    tagId,
    lifeDay,
  };

  trackEvent('share_export_started', {
    ...baseContext,
    exportStage: shareAfterSave ? 'save_and_share' : 'save_only',
  });

  try {
    const capturedUri = await captureRef(captureTarget, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });

    if (!capturedUri) {
      throw new StoryShareExportError('캡처 이미지를 만들지 못했습니다.', 'capture');
    }

    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) {
      throw new StoryShareExportError('이미지를 저장하려면 사진 보관함 권한이 필요합니다.', 'permission');
    }

    const asset = await MediaLibrary.createAssetAsync(capturedUri);
    const imagePath = asset.uri ?? capturedUri;
    const layoutVersion = 'share-mode-v1';

    let storyCard = await saveStoryCardSnapshot({
      groupId,
      groupTagId: tagId,
      lifestyleDate: lifeDay,
      imageUri: imagePath,
      assetId: asset.id,
      layoutVersion,
      shared: false,
      platform: getExportPlatform(),
    });

    trackEvent('snapshot_saved', {
      ...baseContext,
      imagePath,
      storyCardId: storyCard.id,
    });

    let shared = false;
    if (shareAfterSave) {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        throw new StoryShareExportError('이 기기에서는 공유 시트를 사용할 수 없습니다.', 'share');
      }

      trackEvent('share_sheet_opened', baseContext);
      await Sharing.shareAsync(capturedUri, {
        dialogTitle: 'Tabbit 스토리 공유',
        mimeType: 'image/png',
      });
      shared = true;
      storyCard = await saveStoryCardSnapshot({
        groupId,
        groupTagId: tagId,
        lifestyleDate: lifeDay,
        imageUri: imagePath,
        assetId: asset.id,
        layoutVersion,
        shared: true,
        platform: getExportPlatform(),
        incrementExportCount: false,
      });
    }

    trackEvent('share_export_succeeded', {
      ...baseContext,
      exportStage: shared ? 'share' : 'save',
    });

    return {
      ok: true,
      imagePath,
      shared,
      storyCard,
    };
  } catch (error) {
    const exportError =
      error instanceof StoryShareExportError
        ? error
        : new StoryShareExportError('스토리 export 중 예기치 못한 오류가 발생했습니다.', 'save');

    trackEvent('share_export_failed', {
      ...baseContext,
      exportStage: exportError.stage,
      reason: exportError.message,
    });

    captureHandledError(error, {
      ...baseContext,
      exportStage: exportError.stage,
      reason: exportError.message,
    });

    return {
      ok: false,
      message: exportError.message,
      stage: exportError.stage,
    };
  }
}
