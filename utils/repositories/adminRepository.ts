/**
 * Admin Repository
 *
 * Data access for admin operations: list users, toggle active status, create users.
 * All admin functions are SECURITY DEFINER in PostgreSQL — the DB enforces authorization.
 */

import { supabase } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminUser {
    id: string;
    email: string;
    display_name: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    banned_until: string | null;
    role: 'admin' | 'user';
}

// ---------------------------------------------------------------------------
// Check admin
// ---------------------------------------------------------------------------

export async function checkIsAdmin(): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('is_admin');
        if (error) {
            logger.warn('adminRepository', 'is_admin RPC failed', { error: error.message });
            return false;
        }
        return data === true;
    } catch (err) {
        logger.warn('adminRepository', 'is_admin exception', { error: String(err) });
        return false;
    }
}

// ---------------------------------------------------------------------------
// List users
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<AdminUser[]> {
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) {
        logger.error('adminRepository', 'admin_list_users failed', { error: error.message });
        throw new Error(error.message);
    }
    return (data as AdminUser[]) ?? [];
}

// ---------------------------------------------------------------------------
// Toggle user active/inactive
// ---------------------------------------------------------------------------

export async function toggleUserActive(userId: string, ban: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_toggle_user', {
        target_user_id: userId,
        ban,
    });
    if (error) {
        logger.error('adminRepository', 'admin_toggle_user failed', { error: error.message });
        throw new Error(error.message);
    }
}

// ---------------------------------------------------------------------------
// Create user (invite with temp password)
// ---------------------------------------------------------------------------

export async function createUser(
    email: string,
    password: string,
    displayName: string,
): Promise<{ userId: string | null; error: string | null }> {
    // Use a separate client so the admin's session is not affected
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await tempClient.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: displayName },
        },
    });

    if (error) {
        logger.error('adminRepository', 'createUser signUp failed', { error: error.message });
        return { userId: null, error: error.message };
    }

    const userId = data.user?.id ?? null;
    logger.info('adminRepository', 'User created', { email, userId });
    return { userId, error: null };
}

// ---------------------------------------------------------------------------
// Set user role
// ---------------------------------------------------------------------------

export async function setUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
    const { error } = await supabase.rpc('admin_set_role', {
        target_user_id: userId,
        new_role: role,
    });
    if (error) {
        logger.error('adminRepository', 'admin_set_role failed', { error: error.message });
        throw new Error(error.message);
    }
}
