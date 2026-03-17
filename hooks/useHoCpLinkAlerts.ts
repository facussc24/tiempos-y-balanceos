/**
 * useHoCpLinkAlerts — Hook for HO → CP link integrity validation
 *
 * Loads the linked Control Plan and runs cross-validation to detect
 * broken cpItemId references in HO quality checks.
 * Provides actions to unlink or re-link individual quality checks.
 *
 * @module useHoCpLinkAlerts
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { HoDocument } from '../modules/hojaOperaciones/hojaOperacionesTypes';
import type { ControlPlanDocument } from '../modules/controlPlan/controlPlanTypes';
import {
    validateHoCpLinks,
    getBrokenHoCheckIds,
    getCpRelinkCandidates,
    type HoCpLinkValidationResult,
} from '../utils/hoCpLinkValidation';
import { loadCpByProjectName } from '../utils/repositories/cpRepository';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseHoCpLinkAlertsReturn {
    /** Full validation result */
    validation: HoCpLinkValidationResult;
    /** Set of quality check IDs with broken links (for row highlighting) */
    brokenCheckIds: Set<string>;
    /** Whether the validation is currently loading */
    isLoading: boolean;
    /** Unlink a quality check (clear its cpItemId) */
    unlinkCheck: (sheetId: string, checkId: string) => void;
    /** Re-link a quality check to a different CP item */
    relinkCheck: (sheetId: string, checkId: string, newCpItemId: string) => void;
    /** CP item candidates for re-linking */
    cpCandidates: { id: string; label: string }[];
    /** Re-run validation (e.g., after unlink/relink) */
    revalidate: () => void;
}

const EMPTY_RESULT: HoCpLinkValidationResult = {
    brokenLinks: [],
    totalBroken: 0,
    isValid: false,
};

const EMPTY_SET = new Set<string>();

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHoCpLinkAlerts(
    hoDoc: HoDocument | null,
    linkedCpProject: string | null | undefined,
    onUpdateQualityCheckCpItemId: ((sheetId: string, checkId: string, cpItemId: string | undefined) => void) | null,
): UseHoCpLinkAlertsReturn {
    const [cpDoc, setCpDoc] = useState<ControlPlanDocument | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [revalidateKey, setRevalidateKey] = useState(0);

    // Load CP document when linkedCpProject changes
    useEffect(() => {
        if (!linkedCpProject) {
            setCpDoc(null);
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        loadCpByProjectName(linkedCpProject)
            .then(result => {
                if (!cancelled) setCpDoc(result?.doc ?? null);
            })
            .catch(err => {
                logger.error('useHoCpLinkAlerts', 'Failed to load linked CP', {}, err instanceof Error ? err : undefined);
                if (!cancelled) setCpDoc(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [linkedCpProject, revalidateKey]);

    const validation = useMemo(
        () => validateHoCpLinks(hoDoc, cpDoc),
        [hoDoc, cpDoc],
    );

    const brokenCheckIds = useMemo(
        () => validation.isValid ? getBrokenHoCheckIds(validation) : EMPTY_SET,
        [validation],
    );

    const cpCandidates = useMemo(
        () => cpDoc ? getCpRelinkCandidates(cpDoc) : [],
        [cpDoc],
    );

    const unlinkCheck = useCallback((sheetId: string, checkId: string) => {
        onUpdateQualityCheckCpItemId?.(sheetId, checkId, undefined);
    }, [onUpdateQualityCheckCpItemId]);

    const relinkCheck = useCallback((sheetId: string, checkId: string, newCpItemId: string) => {
        onUpdateQualityCheckCpItemId?.(sheetId, checkId, newCpItemId);
    }, [onUpdateQualityCheckCpItemId]);

    const revalidate = useCallback(() => setRevalidateKey(k => k + 1), []);

    return {
        validation,
        brokenCheckIds,
        isLoading,
        unlinkCheck,
        relinkCheck,
        cpCandidates,
        revalidate,
    };
}
