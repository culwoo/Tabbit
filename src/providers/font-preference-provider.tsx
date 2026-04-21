import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { TextStyle } from 'react-native';

import { paperFonts } from '@/components/ui/paper-design';

const STORAGE_KEY = 'tabbit:font-preset';

export type FontPresetId = 'tabbit' | 'pretendard' | 'system' | 'pen';

export type FontPreset = {
  id: FontPresetId;
  label: string;
  description: string;
  regularFamily?: string;
  strongFamily?: string;
};

export const FONT_PRESETS: FontPreset[] = [
  {
    id: 'tabbit',
    label: 'Tabbit 기본',
    description: '현재 손글씨 느낌',
    regularFamily: paperFonts.handBold,
    strongFamily: paperFonts.handBold,
  },
  {
    id: 'pretendard',
    label: 'Pretendard',
    description: '가장 또렷한 본문',
    regularFamily: 'Pretendard-Regular',
    strongFamily: 'Pretendard-SemiBold',
  },
  {
    id: 'system',
    label: '기기 기본',
    description: '휴대폰 기본 글꼴',
  },
  {
    id: 'pen',
    label: '손글씨',
    description: '더 가벼운 낙서체',
    regularFamily: paperFonts.pen,
    strongFamily: paperFonts.pen,
  },
];

type FontPreferenceContextValue = {
  bodyTextStyle: TextStyle;
  fontPreset: FontPreset;
  fontPresets: FontPreset[];
  setFontPreset: (presetId: FontPresetId) => Promise<void>;
  strongTextStyle: TextStyle;
};

const FontPreferenceContext = createContext<FontPreferenceContextValue | null>(null);

function isFontPresetId(value: string | null): value is FontPresetId {
  return FONT_PRESETS.some((preset) => preset.id === value);
}

export function FontPreferenceProvider({ children }: PropsWithChildren) {
  const [fontPresetId, setFontPresetId] = useState<FontPresetId>('tabbit');

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (mounted && isFontPresetId(value)) {
          setFontPresetId(value);
        }
      })
      .catch((error) => {
        console.warn('[FontPreferenceProvider] failed to load font preference', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setFontPreset = useCallback(async (presetId: FontPresetId) => {
    setFontPresetId(presetId);
    await AsyncStorage.setItem(STORAGE_KEY, presetId);
  }, []);

  const fontPreset = FONT_PRESETS.find((preset) => preset.id === fontPresetId) ?? FONT_PRESETS[0];

  const value = useMemo<FontPreferenceContextValue>(() => {
    const bodyTextStyle: TextStyle = fontPreset.regularFamily
      ? { fontFamily: fontPreset.regularFamily }
      : {};
    const strongTextStyle: TextStyle = fontPreset.strongFamily
      ? { fontFamily: fontPreset.strongFamily }
      : bodyTextStyle;

    return {
      bodyTextStyle,
      fontPreset,
      fontPresets: FONT_PRESETS,
      setFontPreset,
      strongTextStyle,
    };
  }, [fontPreset, setFontPreset]);

  return <FontPreferenceContext.Provider value={value}>{children}</FontPreferenceContext.Provider>;
}

export function useFontPreference() {
  const value = useContext(FontPreferenceContext);

  if (!value) {
    throw new Error('useFontPreference must be used within FontPreferenceProvider');
  }

  return value;
}
