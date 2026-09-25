import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile } from '../types';
import { setLikeUser } from '../services/likeService';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  /** Supabase anonymous session (used only for likes when enabled). */
  isAnonymous: boolean;
  /** true until the initial session + profile have been resolved */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return null;
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const currentUserId = useRef<string | null>(null);

  // Session and profile are applied together, and `loading` stays true while a
  // user's profile loads, so guards never see "signed in but not admin yet".
  // getSession() and the INITIAL_SESSION event can arrive together; both await
  // the same in-flight profile request.
  const pendingProfile = useRef<Promise<Profile | null>>(Promise.resolve(null));
  const applySession = useCallback(async (s: Session | null) => {
    const uid = s?.user.id ?? null;
    setLikeUser(uid);
    if (uid !== currentUserId.current) {
      currentUserId.current = uid;
      if (uid) setLoading(true);
      pendingProfile.current = uid ? loadProfile(uid) : Promise.resolve(null);
    }
    const p = await pendingProfile.current;
    if (currentUserId.current !== uid) return; // superseded by a newer auth event
    setProfile(p);
    setSession(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) void applySession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer: calling Supabase inside this callback can deadlock the client.
      setTimeout(() => {
        if (active) void applySession(s);
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (currentUserId.current) {
      pendingProfile.current = loadProfile(currentUserId.current);
      setProfile(await pendingProfile.current);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      // UI hint only; the database enforces admin rights via RLS.
      isAdmin: profile?.role === 'admin' && !session?.user.is_anonymous,
      isAnonymous: Boolean(session?.user.is_anonymous),
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
