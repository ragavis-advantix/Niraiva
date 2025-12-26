import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,        // ✅ CRITICAL: Persist session in localStorage
    autoRefreshToken: true,       // ✅ Auto-refresh tokens before expiry
    detectSessionInUrl: true,     // ✅ Detect session from OAuth redirects
    storage: window.localStorage  // ✅ Use localStorage for session storage
  }
});

// Type definitions for database
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          first_name: string;
          middle_name: string | null;
          last_name: string | null;
          dob: string;
          gender: string;
          mobile_number: string;
          mobile_verified: boolean;
          email: string | null;
          photo: string | null;
          phr_address: string | null;
          address: string;
          district_code: string;
          state_code: string;
          pin_code: string;
          abha_type: string | null;
          state_name: string;
          district_name: string;
          abha_status: string;
          preferred_abha_address: string | null;
          abha_number: string | null;
          abha_profile: any | null;
          created_at: string;
          updated_at: string;
          mobile: string | null;
          allergies: string[] | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name?: string;
          middle_name?: string | null;
          last_name?: string | null;
          dob?: string;
          gender?: string;
          mobile_number?: string;
          mobile_verified?: boolean;
          allergies?: string[] | null;
          [key: string]: any;
        };
        Update: {
          first_name?: string;
          middle_name?: string | null;
          last_name?: string | null;
          allergies?: string[] | null;
          [key: string]: any;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          updated_at?: string;
        };
      };
      health_data: {
        Row: {
          id: string;
          user_id: string;
          data_type: string;
          data: JSON;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          data_type: string;
          data: JSON;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          data?: JSON;
          updated_at?: string;
        };
      };
    };
  };
};