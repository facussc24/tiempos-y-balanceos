/**
 * Supabase Client
 *
 * Singleton Supabase client for Barack Mercosul web.
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from environment variables.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[SupabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. ' +
        'Copy .env.example to .env and fill in your Supabase credentials.'
    );
}

export const supabase = createClient(
    supabaseUrl ?? 'https://placeholder.supabase.co',
    supabaseAnonKey ?? 'placeholder-key',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
);

export type { User, Session } from '@supabase/supabase-js';
