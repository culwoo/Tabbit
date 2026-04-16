import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/tokens';

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class AppErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO: Crashlytics 실 연동 시 여기서 전송
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.emoji}>😵</Text>
            <Text style={styles.title}>앗, 문제가 생겼어요</Text>
            <Text style={styles.description}>
              앱에서 예기치 못한 오류가 발생했습니다.{'\n'}
              아래 버튼을 눌러 다시 시도해 주세요.
            </Text>
            {__DEV__ && this.state.error ? (
              <View style={styles.debugBox}>
                <Text style={styles.debugTitle}>개발 모드 — 에러 정보</Text>
                <Text style={styles.debugText} numberOfLines={8}>
                  {this.state.error.message}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              accessibilityLabel="앱 다시 시도"
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={this.handleReset}
              style={styles.button}
            >
              <Text style={styles.buttonText}>다시 시도하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.bg.canvas,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderColor: colors.line.soft,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.xxl,
    width: '100%',
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    textAlign: 'center',
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
  debugBox: {
    backgroundColor: colors.bg.sunken,
    borderRadius: radius.input,
    gap: spacing.xs,
    padding: spacing.md,
    width: '100%',
  },
  debugTitle: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  debugText: {
    color: colors.status.danger,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    backgroundColor: colors.surface.inverse,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
});
