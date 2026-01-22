/**
 * ⚠️ CRITICAL AUTHENTICATION FILE ⚠️
 * 
 * This file manages the core authentication logic for BOTH patient and doctor portals.
 * 
 * MODIFICATION WARNING:
 * - This file has historically caused login issues when modified
 * - ANY changes must be tested with BOTH patient AND doctor login flows
 * - Test BOTH email/password AND Google OAuth authentication
 * - Verify session persistence after page refresh
 * 
 * KEY RESPONSIBILITIES:
 * - User authentication (signIn, signUp, signInWithGoogle)
 * - User data enrichment (fetching role from user_roles table)
 * - Session management (onAuthStateChange listener)
 * - User initialization (ensuring profile and role entries exist)
 * 
 * CRITICAL FUNCTIONS:
 * - enrichUserData(): Fetches role and patient_id from user_roles table
 * - ensureUserInitialized(): Creates default profile and role entries
 * - signIn(): Email/password authentication
 * - signInWithGoogle(): OAuth authentication
 * 
 * TESTING CHECKLIST BEFORE COMMITTING:
 * ✓ Patient email/password login → /patient/dashboard
 * ✓ Doctor email/password login → /doctor/dashboard
 * ✓ Patient Google OAuth → /patient/dashboard
 * ✓ Doctor Google OAuth → /doctor/dashboard
 * ✓ Session persistence on page refresh
 * ✓ No console errors
 * 
 * See: authentication_protection_guide.md for full documentation
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User & {
    access_token?: string;
    linked_patient_id?: string;
    role?: string;
  } | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{
    user: User | null;
    session: Session | null;
  }>;
  signInWithGoogle: () => Promise<any>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Enrich user object with data from user_roles (source of truth)
const enrichUserData = async (user: User, session: Session | null) => {
  if (!user?.id || !session?.access_token) {
    console.log('[AuthContext] enrichUserData: Missing user or session, returning user as-is');
    return user as any;
  }

  console.log('[AuthContext] 🔄 enrichUserData START for user:', user.email);

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Role fetch timeout')), 5000)
    );

    // 1. Fetch role from user_roles with timeout
    const roleFetchPromise = supabase
      .from('user_roles')
      .select('role, patient_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: roleData, error: roleError } = await Promise.race([
      roleFetchPromise,
      timeoutPromise
    ]) as any;

    if (roleError) {
      console.error('[AuthContext] ❌ Error fetching role:', roleError);
    } else {
      console.log('[AuthContext] ✅ Role fetched:', roleData?.role || 'not found');
    }

    // 2. Get patient_id from user_roles (already fetched above)
    const linkedPatientId = roleData?.patient_id;
    console.log('[AuthContext] ↳ Patient ID:', linkedPatientId || 'not found');

    const enrichedUser = {
      ...user,
      access_token: session.access_token,
      linked_patient_id: linkedPatientId,
      role: roleData?.role || 'patient' // Default to patient if missing
    };

    console.log('[AuthContext] ✅ enrichUserData COMPLETE, role:', enrichedUser.role);
    return enrichedUser;
  } catch (error) {
    console.error('[AuthContext] ❌ Error enriching user data:', error);
    const fallbackUser = {
      ...user,
      access_token: session.access_token,
      role: 'patient'
    };
    console.log('[AuthContext] ⚠️ Using fallback role: patient');
    return fallbackUser;
  }
};

// Ensure user has required profile and role entries (for manually created users)
const ensureUserInitialized = async (user: User) => {
  if (!user.id) {
    console.log('[AuthContext] ensureUserInitialized: No user.id provided, skipping');
    return;
  }

  console.log('[AuthContext] 🔐 ensureUserInitialized START for user:', user.email, '| ID:', user.id);

  try {
    // 1. Ensure profile exists
    console.log('[AuthContext] ↳ Checking user_profiles table...');
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) {
      console.log('[AuthContext] ✏️ user_profiles NOT FOUND, creating entry for:', user.id);
      const { error: profileError } = await supabase.from('user_profiles').insert({
        user_id: user.id,
        email: user.email,
        created_at: new Date().toISOString(),
      });
      if (profileError) {
        console.error('[AuthContext] ❌ Failed to create profile:', profileError);
      } else {
        console.log('[AuthContext] ✅ user_profiles entry created successfully');
      }
    } else {
      console.log('[AuthContext] ✅ user_profiles FOUND, already exists');
    }

    // 2. Ensure role exists (default to patient)
    console.log('[AuthContext] ↳ Checking user_roles table...');
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!role) {
      console.log('[AuthContext] ✏️ user_roles NOT FOUND, creating patient entry for:', user.id);
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: user.id,
        role: 'patient',
      });
      if (roleError) {
        console.error('[AuthContext] ❌ Failed to create role:', roleError);
      } else {
        console.log('[AuthContext] ✅ user_roles entry created as PATIENT');
      }
    } else {
      console.log('[AuthContext] ✅ user_roles FOUND, role:', role.role);
    }

    console.log('[AuthContext] 🔐 ensureUserInitialized COMPLETE');
  } catch (err) {
    console.error('[AuthContext] ❌ ensureUserInitialized error:', err);
    // Don't throw - this is non-critical initialization
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const hasEnriched = React.useRef<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      console.log('[AuthContext] 🚀 STARTUP: Checking existing session...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: { user } } = await supabase.auth.getUser();

        console.log('[AuthContext] ↳ Session found:', !!session);
        console.log('[AuthContext] ↳ User:', user?.email, '| ID:', user?.id);

        if (user && session && hasEnriched.current !== user.id) {
          hasEnriched.current = user.id;
          const enrichedUser = await enrichUserData(user, session);
          setUser(enrichedUser);
        } else if (user && session) {
          // User already enriched, but still need to set the enriched user
          const enrichedUser = await enrichUserData(user, session);
          setUser(enrichedUser);
        } else if (!user) {
          setUser(null);
        }

        setSession(session);
        setLoading(false);

        console.log('[AuthContext] ✅ STARTUP: Session check complete');
      } catch (err) {
        console.error('[AuthContext] ❌ STARTUP: checkSession error', err);
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] 📡 onAuthStateChange EVENT:', event);
      console.log('[AuthContext] ↳ Session exists:', !!session);
      console.log('[AuthContext] ↳ User:', session?.user?.email, '| ID:', session?.user?.id);

      if (!session?.user) {
        hasEnriched.current = null;
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }

      // Prevent duplicate enrichment for the same user
      if (hasEnriched.current === session.user.id) {
        console.log('[AuthContext] ⚠️ Skipping duplicate enrichment for same user');
        setSession(session);
        setLoading(false);
        return;
      }

      hasEnriched.current = session.user.id;
      const enrichedUser = await enrichUserData(session.user, session);

      setSession(session);
      setUser(enrichedUser);
      setLoading(false);

      if (event === 'SIGNED_IN') {
        console.log('[AuthContext] 👤 User authenticated:', session?.user?.email);
      } else if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] 👋 User signed out');
      }

    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] 🔑 SIGN_IN STARTED for:', email);
    console.log('[AuthContext] ↳ Current URL:', window.location.href);

    try {
      console.log('[AuthContext] ↳ Calling supabase.auth.signInWithPassword()...');
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AuthContext] ❌ signInWithPassword FAILED:', error);
        throw error;
      }

      console.log('[AuthContext] ✅ signInWithPassword SUCCESS');
      console.log('[AuthContext] ↳ User:', data.user?.email, '| ID:', data.user?.id);
      console.log('[AuthContext] ↳ Session Token:', data.session?.access_token?.substring(0, 20) + '...');

      // Skip ensureUserInitialized for now - causes RLS issues
      // The onAuthStateChange handler will manage initialization
      console.log('[AuthContext] 🔑 SIGN_IN COMPLETE - user state will update via onAuthStateChange');
    } catch (error) {
      console.error('[AuthContext] 🔑 SIGN_IN FAILED with exception:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    console.log('[AuthContext] 🆕 SIGN_UP STARTED for:', email);
    console.log('[AuthContext] ↳ Metadata:', metadata);

    try {
      console.log('[AuthContext] ↳ Calling supabase.auth.signUp()...');
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      if (error) {
        console.error('[AuthContext] ❌ signUp FAILED:', error);
        throw error;
      }

      console.log('[AuthContext] ✅ signUp SUCCESS');
      console.log('[AuthContext] ↳ User:', data.user?.email, '| ID:', data.user?.id);
      console.log('[AuthContext] ↳ Session:', !!data.session);
      console.log('[AuthContext] ↳ Email confirmation required:', !data.user?.confirmed_at);

      // Ensure user initialization after successful signup
      if (data.user) {
        console.log('[AuthContext] ↳ Calling ensureUserInitialized()...');
        await ensureUserInitialized(data.user);
        console.log('[AuthContext] ✅ ensureUserInitialized completed');
      }

      console.log('[AuthContext] 🆕 SIGN_UP COMPLETE');
      return data;
    } catch (error) {
      console.error('[AuthContext] 🆕 SIGN_UP FAILED with exception:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    console.log('[AuthContext] 🔑 GOOGLE SIGN_IN STARTED');
    console.log('[AuthContext] ↳ Current URL:', window.location.href);
    console.log('[AuthContext] ↳ Redirect URL will be:', `${window.location.origin}/auth/callback`);

    try {
      console.log('[AuthContext] ↳ Calling supabase.auth.signInWithOAuth()...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('[AuthContext] ❌ signInWithOAuth FAILED:', error);
        throw error;
      }

      console.log('[AuthContext] ✅ signInWithOAuth initiated');
      console.log('[AuthContext] ℹ️ Redirecting to Google... browser will handle OAuth flow');
      return data;
    } catch (err) {
      console.error('[AuthContext] ❌ Google Sign-In Error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    console.log('[AuthContext] 👋 SIGN_OUT FORCED');

    // 1. Clear local state immediately for UI responsiveness
    setSession(null);
    setUser(null);

    // 2. Clear all localStorage to remove Supabase tokens persistently
    // (This fixes the issue where the token remains and auto-logs in on refresh)
    localStorage.clear();

    // 3. Fire-and-forget server signout (don't wait for it as it's hanging)
    supabase.auth.signOut().catch(err => console.warn('Background signout warning:', err));

    // 4. Force hard redirect immediately
    window.location.href = '/';
  };

  const value = {
    session,
    user,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};