import { Redirect } from 'expo-router';

import { useAppSession } from '@/providers/app-session-provider';

export default function IndexRoute() {
  const { bootstrapState } = useAppSession();

  if (bootstrapState === 'signed-in') {
    return <Redirect href="/(tabs)/index" />;
  }

  return <Redirect href="/sign-in" />;
}
