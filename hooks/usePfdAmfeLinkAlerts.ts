/**
 * usePfdAmfeLinkAlerts — Hook for PFD ↔ AMFE link integrity validation
 *
 * Loads the linked counterpart document and runs cross-validation to detect
 * broken links. Provides actions to unlink or re-link individual items.
 *
 * @module usePfdAmfeLinkAlerts
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PfdDocument } from '../modules/pfd/pfdTypes';
import type { AmfeDocument } from '../modules/amfe/amfeTypes';
import {
    validatePfdAmfeLinks,
    getBrokenPfdStepIds,
    getBrokenAmfeOperationIds,
    getRelinkCandidates,
    type PfdAmfeLinkValidationResult,
} from '../utils/pfdAmfeLinkValidation';
import { loadPfdDocument } from '../utils/repositories/pfdRepository';
import { loadAmfeDocument } from '../utils/repositories/amfeRepository';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePfdAmfeLinkAlertsReturn {
    /** Full validation result */
    validation: PfdAmfeLinkValidationResult;
    /** Set of PFD step IDs with broken links (for row highlighting) */
    brokenPfdStepIds: Set<string>;
    /** Set of AMFE operation IDs with broken links (for row highlighting) */
    brokenAmfeOpIds: Set<string>;
    /** Whether the validation is currently loading */
    isLoading: boolean;
    /** Unlink a PFD step (clear its linkedAmfeOperationId) */
    unlinkPfdStep: (stepId: string) => void;
    /** Unlink an AMFE operation (clear its linkedPfdStepId) */
    unlinkAmfeOp: (operationId: string) => void;
    /** Re-link a PFD step to a different AMFE operation */
    relinkPfdStep: (stepId: string, newAmfeOpId: string) => void;
    /** Re-link an AMFE operation to a different PFD step */
    relinkAmfeOp: (operationId: string, newPfdStepId: string) => void;
    /** Candidates for re-linking */
    amfeCandidates: { id: string; label: string }[];
    pfdCandidates: { id: string; label: string }[];
    /** Re-run validation (e.g., after unlink/relink) */
    revalidate: () => void;
}

const EMPTY_RESULT: PfdAmfeLinkValidationResult = {
    brokenPfdLinks: [],
    brokenAmfeLinks: [],
    totalBroken: 0,
    isValid: false,
};

const EMPTY_SET = new Set<string>();

// ---------------------------------------------------------------------------
// Hook: for PFD module (has PFD doc, needs to load AMFE)
// ---------------------------------------------------------------------------

export function usePfdAmfeLinkAlerts(
    pfdDoc: PfdDocument | null,
    linkedAmfeId: string | null | undefined,
    onUpdateStep: ((stepId: string, field: string, value: unknown) => void) | null,
): UsePfdAmfeLinkAlertsReturn {
    const [amfeDoc, setAmfeDoc] = useState<AmfeDocument | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [revalidateKey, setRevalidateKey] = useState(0);

    // Load AMFE document when linkedAmfeId changes
    useEffect(() => {
        if (!linkedAmfeId) {
            setAmfeDoc(null);
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        loadAmfeDocument(linkedAmfeId)
            .then(result => {
                if (!cancelled) setAmfeDoc(result?.doc ?? null);
            })
            .catch(err => {
                logger.error('usePfdAmfeLinkAlerts', 'Failed to load linked AMFE', {}, err instanceof Error ? err : undefined);
                if (!cancelled) setAmfeDoc(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [linkedAmfeId, revalidateKey]);

    const validation = useMemo(
        () => validatePfdAmfeLinks(pfdDoc, amfeDoc),
        [pfdDoc, amfeDoc],
    );

    const brokenPfdStepIds = useMemo(() => getBrokenPfdStepIds(validation), [validation]);
    const brokenAmfeOpIds = useMemo(() => getBrokenAmfeOperationIds(validation), [validation]);

    const candidates = useMemo(
        () => pfdDoc && amfeDoc ? getRelinkCandidates(pfdDoc, amfeDoc) : { amfeCandidates: [], pfdCandidates: [] },
        [pfdDoc, amfeDoc],
    );

    const unlinkPfdStep = useCallback((stepId: string) => {
        onUpdateStep?.(stepId, 'linkedAmfeOperationId', undefined);
    }, [onUpdateStep]);

    const relinkPfdStep = useCallback((stepId: string, newAmfeOpId: string) => {
        onUpdateStep?.(stepId, 'linkedAmfeOperationId', newAmfeOpId);
    }, [onUpdateStep]);

    // AMFE unlink/relink not available from PFD context
    const unlinkAmfeOp = useCallback(() => {}, []);
    const relinkAmfeOp = useCallback(() => {}, []);

    const revalidate = useCallback(() => setRevalidateKey(k => k + 1), []);

    return {
        validation,
        brokenPfdStepIds,
        brokenAmfeOpIds,
        isLoading,
        unlinkPfdStep,
        unlinkAmfeOp,
        relinkPfdStep,
        relinkAmfeOp,
        amfeCandidates: candidates.amfeCandidates,
        pfdCandidates: candidates.pfdCandidates,
        revalidate,
    };
}

// ---------------------------------------------------------------------------
// Hook: for AMFE module (has AMFE doc, needs to load PFD)
// ---------------------------------------------------------------------------

export function useAmfePfdLinkAlerts(
    amfeDoc: AmfeDocument | null,
    linkedPfdId: string | null | undefined,
    onUpdateOperation: ((operationId: string, field: string, value: unknown) => void) | null,
): UsePfdAmfeLinkAlertsReturn {
    const [pfdDoc, setPfdDoc] = useState<PfdDocument | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [revalidateKey, setRevalidateKey] = useState(0);

    // Load PFD document when linkedPfdId changes
    useEffect(() => {
        if (!linkedPfdId) {
            setPfdDoc(null);
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        loadPfdDocument(linkedPfdId)
            .then(result => {
                if (!cancelled) setPfdDoc(result);
            })
            .catch(err => {
                logger.error('useAmfePfdLinkAlerts', 'Failed to load linked PFD', {}, err instanceof Error ? err : undefined);
                if (!cancelled) setPfdDoc(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [linkedPfdId, revalidateKey]);

    const validation = useMemo(
        () => validatePfdAmfeLinks(pfdDoc, amfeDoc),
        [pfdDoc, amfeDoc],
    );

    const brokenPfdStepIds = useMemo(() => getBrokenPfdStepIds(validation), [validation]);
    const brokenAmfeOpIds = useMemo(() => getBrokenAmfeOperationIds(validation), [validation]);

    const candidates = useMemo(
        () => pfdDoc && amfeDoc ? getRelinkCandidates(pfdDoc, amfeDoc) : { amfeCandidates: [], pfdCandidates: [] },
        [pfdDoc, amfeDoc],
    );

    const unlinkAmfeOp = useCallback((operationId: string) => {
        onUpdateOperation?.(operationId, 'linkedPfdStepId', undefined);
    }, [onUpdateOperation]);

    const relinkAmfeOp = useCallback((operationId: string, newPfdStepId: string) => {
        onUpdateOperation?.(operationId, 'linkedPfdStepId', newPfdStepId);
    }, [onUpdateOperation]);

    // PFD unlink/relink not available from AMFE context
    const unlinkPfdStep = useCallback(() => {}, []);
    const relinkPfdStep = useCallback(() => {}, []);

    const revalidate = useCallback(() => setRevalidateKey(k => k + 1), []);

    return {
        validation,
        brokenPfdStepIds,
        brokenAmfeOpIds,
        isLoading,
        unlinkPfdStep,
        unlinkAmfeOp,
        relinkPfdStep,
        relinkAmfeOp,
        amfeCandidates: candidates.amfeCandidates,
        pfdCandidates: candidates.pfdCandidates,
        revalidate,
    };
}
