import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { requireSupabase } from '@/lib/supabase/client';

WebBrowser.maybeCompleteAuthSession();

export const supabaseRedirectUrl = makeRedirectUri({
  path: 'sign-in',
  scheme: 'tabbit',
});

export async function createSessionFromUrl(url: string) {
  const supabase = requireSupabase();
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
  const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithGoogle() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: supabaseRedirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error('Supabase OAuth URL을 생성하지 못했습니다.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, supabaseRedirectUrl);

  if (result.type !== 'success') {
    return null;
  }

  return createSessionFromUrl(result.url);
}

export async function signOutFromSupabase() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
