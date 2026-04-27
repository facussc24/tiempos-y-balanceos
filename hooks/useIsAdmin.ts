/**
 * useIsAdmin — checks whether the current user has the 'admin' role.
 *
 * Calls the `is_admin()` RPC once on mount and caches the result.
 * Re-checks when the user changes (login/logout).
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { checkIsAdmin } from '../utils/repositories/adminRepository';

export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
    const { user } = useAuth();
    // Cache the admin check keyed by userId so we can derive isAdmin/loading
    // from the current user without setState-in-effect for the "no user" case.
    const [check, setCheck] = useState<{ userId: string; isAdmin: boolean } | null>(null);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        checkIsAdmin().then((result) => {
            if (!cancelled) setCheck({ userId: user.id, isAdmin: result });
        });
        return () => { cancelled = true; };
    }, [user?.id]); // re-check when user changes

    if (!user) return { isAdmin: false, loading: false };
    if (check?.userId !== user.id) return { isAdmin: false, loading: true };
    return { isAdmin: check.isAdmin, loading: false };
}
