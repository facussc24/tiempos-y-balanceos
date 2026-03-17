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
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        checkIsAdmin().then((result) => {
            if (!cancelled) {
                setIsAdmin(result);
                setLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, [user?.id]); // re-check when user changes

    return { isAdmin, loading };
}
