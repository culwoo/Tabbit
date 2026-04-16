import { PropsWithChildren, createContext, useContext, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';

import type { Session, User } from '@supabase/supabase-js';

import { env } from '@/config/env';
import { createSessionFromUrl, signInWithGoogle, signOutFromSupabase } from '@/features/auth/lib/supabase-auth';
import { supabase } from '@/lib/supabase/client';

export type AppBootstrapState = 'checking' | 'signed-out' | 'signed-in';

type AppSessionContextValue = {
  bootstrapState: AppBootstrapState;
  session: Session | null;
  user: User | null;
  userId: string | null;
  isConfigured: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export function AppSessionProvider({ children }: PropsWithChildren) {
  const [bootstrapState, setBootstrapState] = useState<AppBootstrapState>('checking');
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setBootstrapState('signed-out');
      setSession(null);
      return () => {
        isMounted = false;
      };
    }

    const client = supabase;

    async function syncInitialSession() {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          await createSessionFromUrl(initialUrl);
        }

        const { data, error } = await client.auth.getSession();

        if (error) {
          throw error;
        }

        if (!isMounted) {
          return;
        }

        setSession(data.session);
        setBootstrapState(data.session ? 'signed-in' : 'signed-out');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSession(null);
        setAuthError(normalizeAuthError(error));
        setBootstrapState('signed-out');
      }
    }

    void syncInitialSession();

    const authSubscription = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setBootstrapState(nextSession ? 'signed-in' : 'signed-out');
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void createSessionFromUrl(url).catch((error) => {
        if (!isMounted) {
          return;
        }

        setAuthError(normalizeAuthError(error));
      });
    });

    return () => {
      isMounted = false;
      authSubscription.data.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  async function handleSignInWithGoogle() {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const nextSession = await signInWithGoogle();

      if (nextSession) {
        setSession(nextSession);
        setBootstrapState('signed-in');
      }
    } catch (error) {
      setAuthError(normalizeAuthError(error));
      setBootstrapState('signed-out');
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleSignOut() {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      if (supabase) {
        await signOutFromSupabase();
      }

      setSession(null);
      setBootstrapState('signed-out');
    } catch (error) {
      setAuthError(normalizeAuthError(error));
    } finally {
      setIsAuthenticating(false);
    }
  }

  const value: AppSessionContextValue = {
    bootstrapState,
    session,
    user: session?.user ?? null,
    userId: session?.user?.id ?? null,
    isConfigured: env.hasSupabaseConfig,
    isAuthenticating,
    authError,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    clearAuthError: () => setAuthError(null),
  };

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const value = useContext(AppSessionContext);

  if (!value) {
    throw new Error('useAppSession must be used within AppSessionProvider');
  }

  return value;
}

function normalizeAuthError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '알 수 없는 인증 오류가 발생했습니다.';
}
