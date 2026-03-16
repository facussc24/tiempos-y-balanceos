/**
 * Auth Provider
 *
 * Provides Supabase authentication context to the entire app.
 * Auto-signs in using environment variables — no login page needed.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../../utils/supabaseClient';
import type { User, Session } from '../../utils/supabaseClient';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
    children: React.ReactNode;
    /** Render this component when user is not authenticated (unused with auto-login) */
    loginPage?: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get the initial session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) {
                // Already logged in
                setSession(session);
                setUser(session.user);
                setLoading(false);
            } else {
                // No session — auto-login with env vars
                const email = import.meta.env.VITE_AUTO_LOGIN_EMAIL;
                const password = import.meta.env.VITE_AUTO_LOGIN_PASSWORD;

                if (email && password) {
                    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                    if (!error && data.session) {
                        setSession(data.session);
                        setUser(data.session.user);
                    } else {
                        console.error('Auto-login failed:', error?.message);
                    }
                }
                setLoading(false);
            }
        });

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        return { error: null };
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    const value: AuthContextValue = { user, session, loading, signIn, signOut };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-400 text-sm">Conectando...</span>
                </div>
            </div>
        );
    }

    // Always render children — no login page gate
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
