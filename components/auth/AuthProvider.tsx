/**
 * Auth Provider
 *
 * Provides Supabase authentication context to the entire app.
 * Shows a login page when not authenticated.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import type { User, Session } from '../../utils/supabaseClient';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface AuthContextValue {
    user: User | null;
    session: Session | null;
    loading: boolean;
    /** Display name: user_metadata.display_name → email prefix → 'Usuario' */
    userDisplayName: string;
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
// Helpers
// ---------------------------------------------------------------------------

/** Extract a human-readable name from the Supabase user object */
function resolveDisplayName(user: User | null): string {
    if (!user) return '';
    const meta = user.user_metadata;
    if (meta?.display_name) return meta.display_name as string;
    if (meta?.full_name) return meta.full_name as string;
    if (meta?.name) return meta.name as string;
    if (user.email) return user.email.split('@')[0];
    return 'Usuario';
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
    children: React.ReactNode;
    /** Rendered when the user is not authenticated */
    loginPage?: React.ReactNode;
}

export function AuthProvider({ children, loginPage }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setSession(session);
                setUser(session.user);
            }
            setLoading(false);
        });

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

    const userDisplayName = useMemo(() => resolveDisplayName(user), [user]);

    const value: AuthContextValue = { user, session, loading, signIn, signOut, userDisplayName };

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

    // Not authenticated → show login page
    if (!session && loginPage) {
        return (
            <AuthContext.Provider value={value}>
                {loginPage}
            </AuthContext.Provider>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
