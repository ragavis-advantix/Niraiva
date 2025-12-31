import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
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

  useEffect(() => {
    const checkSession = async () => {
      console.log('[AuthContext] 🚀 STARTUP: Checking existing session...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: { user } } = await supabase.auth.getUser();
        
        console.log('[AuthContext] ↳ Session found:', !!session);
        console.log('[AuthContext] ↳ User:', user?.email, '| ID:', user?.id);
        
        setSession(session);
        setUser(user);
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
      console.log('[AuthContext] ↳ Current URL:', window.location.pathname);
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Handle automatic redirection for login events
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        console.log('[AuthContext] 👤 User authenticated:', session.user.email);
        
        // Auto-initialize missing user data (for manually created users)
        console.log('[AuthContext] ↳ Ensuring user initialization...');
        await ensureUserInitialized(session.user);

        const path = window.location.pathname;
        console.log('[AuthContext] ↳ Checking if redirect is needed (current path:', path + ')');
        
        if (path === '/login' || path === '/signup' || path === '/doctor/login' || path === '/' || path === '/auth/callback') {
          console.log('[AuthContext] ↳ Yes, redirect needed from:', path);
          try {
            console.log('[AuthContext] ↳ Fetching user role from database...');
            const { data: roleRow, error: roleError } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (roleError) {
              console.error('[AuthContext] ❌ Role fetch error:', roleError);
              console.log('[AuthContext] ↳ Defaulting to PATIENT role');
            } else {
              console.log('[AuthContext] ✅ Role fetched:', roleRow?.role || 'NOT_SET (default patient)');
            }

            const userRole = roleRow?.role || 'patient';
            let redirectUrl = '/dashboard';
            
            if (userRole === 'doctor') {
              redirectUrl = '/doctor/dashboard';
              console.log('[AuthContext] 🏥 User is DOCTOR, redirecting to:', redirectUrl);
            } else {
              console.log('[AuthContext] 🏥 User is PATIENT, redirecting to:', redirectUrl);
            }

            console.log('[AuthContext] 🔄 REDIRECT:', 'window.location.href =', redirectUrl);
            window.location.href = redirectUrl;
          } catch (err) {
            console.error('[AuthContext] ❌ Role check failed:', err);
            console.log('[AuthContext] 🔄 REDIRECT (fallback):', 'window.location.href = /dashboard');
            window.location.href = '/dashboard';
          }
        } else {
          console.log('[AuthContext] ↳ No redirect needed (already on allowed page)');
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] 👋 User signed out');
      } else {
        console.log('[AuthContext] ℹ️ Other event:', event, '- no auto-redirect');
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

      // Ensure user initialization after successful login
      if (data.user) {
        console.log('[AuthContext] ↳ Calling ensureUserInitialized()...');
        await ensureUserInitialized(data.user);
        console.log('[AuthContext] ✅ ensureUserInitialized completed');
      }
      
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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